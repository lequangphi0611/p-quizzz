import type { TimelineItem } from './timeline.js';
import { buildTimeline } from './timeline.js';
import type { TrainingEventRow } from '../../../../shared/api/index.js';

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

/** `Thứ Ba, 24/11/2026 · 5 prompt · 12 lệnh · 2 lỗi` (the failure part is left out at 0): the header of a group. */
export function dayGroupSummary(label: string, g: Pick<DayGroup, 'prompts' | 'commands' | 'failed'>): string {
  return `${label} · ${g.prompts} prompt · ${g.commands} lệnh${g.failed > 0 ? ` · ${g.failed} lỗi` : ''}`;
}

/** The day groups of a member's events (oldest first), newest day first. */
export const dayGroupsOf = (events: readonly TrainingEventRow[]): DayGroup[] => groupByDay(buildTimeline(events, { memberStuck: false }));

/** The day an event is shown under (that of its turn), or null for an unknown event. */
export function dayKeyOfEvent(events: readonly TrainingEventRow[], eventId: number): string | null {
  const hit = dayGroupsOf(events).find(g => g.items.some(i => i.kind === 'turn' && (i.prompt?.id === eventId || i.tools.some(t => t.event.id === eventId))));
  return hit?.dayKey ?? null;
}

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
