import type { TimelineItem } from './timeline.js';
import { buildTimeline } from './timeline.js';
import type { FlagCode, TrainingEventRow } from '../../../../shared/api/index.js';

export type TurnItem = Extract<TimelineItem, { kind: 'turn' }>;
export type GroupItem = Exclude<TimelineItem, { kind: 'day' }>;

/** One local day of a member's timeline: its turns and session dividers (oldest first) and the numbers of its summary line. */
export interface DayGroup {
  dayKey: string;
  startedAt: number;
  items: GroupItem[];
  prompts: number;
  commands: number;
  failed: number;
}

/**
 * Cuts the items of `buildTimeline` at its day strips into groups, newest day first. Inside a group the order stays oldest to
 * newest. The prompt, command and failure counts come from here, so the header of a group and its rows always agree
 * (commands are the `tool` events only, as in the "N lệnh" of a prompt row).
 */
export function groupByDay(items: readonly TimelineItem[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const item of items) {
    if (item.kind === 'day') { groups.push({ dayKey: item.dayKey, startedAt: item.startedAt, items: [], prompts: 0, commands: 0, failed: 0 }); continue; }
    const g = groups[groups.length - 1]!;
    g.items.push(item);
    if (item.kind !== 'turn') continue;
    if (item.prompt) g.prompts++;
    for (const t of item.tools) {
      if (t.event.kind !== 'tool') continue;
      g.commands++;
      if (t.event.ok === false) g.failed++;
    }
  }
  return groups.reverse();
}

/** The day groups of a member's events (oldest first), newest day first. */
export const dayGroupsOf = (events: readonly TrainingEventRow[]): DayGroup[] => groupByDay(buildTimeline(events, { memberStuck: false }));

/** The day every event is shown under (that of its turn), by event id: one pass over the timeline. */
export function dayKeysByEvent(events: readonly TrainingEventRow[]): Map<number, string> {
  const out = new Map<number, string>();
  for (const g of dayGroupsOf(events)) {
    for (const i of g.items) {
      if (i.kind !== 'turn') continue;
      if (i.prompt) out.set(i.prompt.id, g.dayKey);
      for (const t of i.tools) out.set(t.event.id, g.dayKey);
    }
  }
  return out;
}

/** The day an event is shown under (that of its turn), or null for an unknown event. */
export const dayKeyOfEvent = (events: readonly TrainingEventRow[], eventId: number): string | null => dayKeysByEvent(events).get(eventId) ?? null;

/** The day a turn (key from `buildTimeline`) is shown under, or null. */
export const dayKeyOfTurn = (events: readonly TrainingEventRow[], turnKey: string): string | null =>
  dayGroupsOf(events).find(g => g.items.some(i => i.key === turnKey))?.dayKey ?? null;

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
    for (const item of g.items) {
      if (item.kind !== 'turn') continue;
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
export function dayGroupSpoken(label: string, today: boolean, g: Pick<DayGroup, 'prompts' | 'commands' | 'failed'>): string {
  return `${label}${today ? ', hôm nay' : ''}, ${g.prompts} prompt, ${g.commands} lệnh${g.failed > 0 ? `, ${g.failed} lỗi` : ''}`;
}
