import { buildSessionBlocks, type SessionBlock } from './session-blocks.js';
import { buildTimeline, type Turn } from './timeline.js';
import type { TimelineItem } from './timeline.js';
import type { FlagCode, TrainingEventRow } from '../../../../shared/api/index.js';

export type { SessionBlock } from './session-blocks.js';
export type TurnItem = Turn;

/** One local day of a member's timeline: its session blocks (oldest first) and the numbers of its summary line, the sum of the blocks'. */
export interface DayGroup {
  dayKey: string;
  startedAt: number;
  blocks: SessionBlock[];
  prompts: number;
  commands: number;
  failed: number;
}

/** The turns of a day in the order they are shown: block by block, each block oldest first. */
export const turnsOfDay = (g: Pick<DayGroup, 'blocks'>): Turn[] => g.blocks.flatMap(b => b.turns);

/**
 * Cuts the items of `buildTimeline` at its day strips into groups, newest day first, and each day into session blocks (S43). The
 * prompt, command and failure counts of a day are the sums of its blocks, so a header and its rows always agree (commands are the
 * `tool` events only, as in the "N lệnh" of a prompt row).
 */
export function groupByDay(items: readonly TimelineItem[]): DayGroup[] {
  const days: { dayKey: string; startedAt: number; turns: Turn[] }[] = [];
  for (const item of items) {
    if (item.kind === 'day') days.push({ dayKey: item.dayKey, startedAt: item.startedAt, turns: [] });
    else days[days.length - 1]!.turns.push(item);
  }
  const blocks = buildSessionBlocks(days);
  return days.map((d, i): DayGroup => {
    const bs = blocks[i]!;
    return { dayKey: d.dayKey, startedAt: d.startedAt, blocks: bs, prompts: sum(bs, 'prompts'), commands: sum(bs, 'commands'), failed: sum(bs, 'failed') };
  }).reverse();
}

const sum = (blocks: readonly SessionBlock[], field: 'prompts' | 'commands' | 'failed') => blocks.reduce((n, b) => n + b[field], 0);

const groupCache = new WeakMap<readonly TrainingEventRow[], DayGroup[]>();

/** The day groups of a member's events (oldest first), newest day first. Cached per events array: the page asks on every scroll. */
export function dayGroupsOf(events: readonly TrainingEventRow[]): DayGroup[] {
  let groups = groupCache.get(events);
  if (!groups) { groups = groupByDay(buildTimeline(events, { memberStuck: false })); groupCache.set(events, groups); }
  return groups;
}

/** Where an event is shown: its day, its session block and its turn. */
export interface EventPlace { dayKey: string; blockKey: string; turnKey: string }

/** Where every event is shown, by event id: one pass over the timeline. */
export function placesByEvent(events: readonly TrainingEventRow[]): Map<number, EventPlace> {
  const out = new Map<number, EventPlace>();
  for (const g of dayGroupsOf(events)) {
    for (const b of g.blocks) {
      for (const t of b.turns) {
        const place = { dayKey: g.dayKey, blockKey: b.key, turnKey: t.key };
        if (t.prompt) out.set(t.prompt.id, place);
        for (const x of t.tools) out.set(x.event.id, place);
      }
    }
  }
  return out;
}

/** The day, block and turn a turn key (from `buildTimeline`) is shown under, or null. */
export function placeOfTurn(events: readonly TrainingEventRow[], turnKey: string): EventPlace | null {
  for (const g of dayGroupsOf(events)) for (const b of g.blocks) if (b.turns.some(t => t.key === turnKey)) return { dayKey: g.dayKey, blockKey: b.key, turnKey };
  return null;
}

/** The day every event is shown under (that of its turn), by event id. */
export const dayKeysByEvent = (events: readonly TrainingEventRow[]): Map<number, string> => new Map([...placesByEvent(events)].map(([id, p]) => [id, p.dayKey]));

/** The commands and permission requests that have an output or a change to open, in the order they are shown: what J / K step through. Days oldest first, then block by block, turn by turn. */
export function openableEvents(events: readonly TrainingEventRow[]): TrainingEventRow[] {
  const out: TrainingEventRow[] = [];
  for (const g of [...dayGroupsOf(events)].reverse()) {
    for (const t of turnsOfDay(g)) for (const x of t.tools) if ((x.event.kind === 'tool' || x.event.kind === 'permission') && (x.event.hasOutput || x.event.hasChange)) out.push(x.event);
  }
  return out;
}

/** The next (`1`) or previous (`-1`) command with something to open, relative to `currentId`, in shown order; null at either end. */
export function stepEvent(events: readonly TrainingEventRow[], currentId: number, step: 1 | -1): TrainingEventRow | null {
  const openable = openableEvents(events);
  const at = openable.findIndex(e => e.id === currentId);
  if (at < 0) return null;
  return openable[at + step] ?? null;
}

/** The prompt that arrived last, wherever it is shown (a collapsed or earlier block may hold it): where "the newest" is. */
export function newestPromptOf(events: readonly TrainingEventRow[]): TrainingEventRow | null {
  for (let i = events.length - 1; i >= 0; i--) if (events[i]!.kind === 'prompt') return events[i]!;
  return null;
}

/** Which days are open, and which days the mentor has already been offered (so a day that appears later is told apart). */
export interface OpenDays { open: string[]; known: string[] }

/**
 * What is open after the days of the timeline changed (`dayKeys`, newest first). The first time days appear only the newest
 * one is open (one day: that day); a day that appears later opens by itself and the other days keep their state.
 */
export function reconcileOpenDays(prev: OpenDays, dayKeys: readonly string[]): OpenDays {
  const fresh = dayKeys.filter(k => !prev.known.includes(k));
  if (fresh.length === 0) return prev;
  const open = prev.known.length === 0 ? [fresh[0]!] : [...prev.open, ...fresh];
  return { open, known: [...prev.known, ...fresh] };
}

/** Which session blocks are open, and which the mentor has already been offered (a block that appears later opens by itself). */
export interface OpenBlocks { open: string[]; known: string[] }

/**
 * What is open after the blocks of the timeline changed. The first time blocks appear, a block opens when it has something
 * unread or its session has no end signal (`isDefaultOpen`); the others fold. A block that appears later (a new session, or a day
 * that got its first prompt) opens by itself, and the blocks already known keep the state the mentor left them in.
 */
export function reconcileOpenBlocks(prev: OpenBlocks, blocks: readonly { key: string; isDefaultOpen: boolean }[]): OpenBlocks {
  const fresh = blocks.filter(b => !prev.known.includes(b.key));
  if (fresh.length === 0) return prev;
  const first = prev.known.length === 0;
  const open = [...prev.open, ...fresh.filter(b => !first || b.isDefaultOpen).map(b => b.key)];
  return { open, known: [...prev.known, ...fresh.map(b => b.key)] };
}

/** The same days opened, plus `dayKey` (no change when it is already open or null). */
export const withDayOpen = (open: readonly string[], dayKey: string | null): string[] =>
  dayKey === null || open.includes(dayKey) ? [...open] : [...open, dayKey];

/** A chip on a folded day: a flag with the events behind it that fall on that day, or "có thể đang kẹt" (`stuck`, jumps like the repeated-failure flag). */
export interface DayFlag { code: FlagCode; count: number; stuck: boolean }

/**
 * The flags of each day (by `dayKey`), from the events behind each flag: a flag belongs to the days its events fall on. While the
 * member is stuck, the "repeated failure" flag gives way to the stuck chip, which sits on the day of the run that is still going.
 */
export function dayFlags(groups: readonly DayGroup[], flags: readonly { code: FlagCode; ids: readonly number[] }[], stuck: boolean): Map<string, DayFlag[]> {
  const out = new Map<string, DayFlag[]>();
  for (const g of groups) {
    const ids = new Set<number>();
    let activeRun = false;
    for (const item of turnsOfDay(g)) {
      if (item.prompt) ids.add(item.prompt.id);
      for (const t of item.tools) { ids.add(t.event.id); if (t.run?.active) activeRun = true; }
    }
    const list: DayFlag[] = [];
    for (const f of flags) {
      const count = f.ids.filter(id => ids.has(id)).length;
      if (count === 0) continue;
      if (f.code === 'repeated_failure' && stuck) { if (activeRun) list.push({ code: f.code, count, stuck: true }); continue; }
      list.push({ code: f.code, count, stuck: false });
    }
    out.set(g.dayKey, list);
  }
  return out;
}

/** `Thứ Hai, 23/11/2026, 4 prompt, 9 lệnh, 3 lỗi`: what a screen reader says for a day header (the failure part is left out at 0). */
export function dayGroupSpoken(label: string, today: boolean, g: Pick<DayGroup, 'prompts' | 'commands' | 'failed'>, newCount = 0): string {
  return `${label}${today ? ', hôm nay' : ''}, ${g.prompts} prompt, ${g.commands} lệnh${g.failed > 0 ? `, ${g.failed} lỗi` : ''}${newCount > 0 ? `, ${newCount} prompt có mục mới` : ''}`;
}
