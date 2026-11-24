import type { TrainingEventRow } from '../../../../shared/api/index.js';

/** Vietnamese weekday names, indexed by `Date#getDay()` (0 = Sunday). */
const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar day of a moment, as `yyyy-mm-dd` (the key sorts in time order). Local = the mentor's browser. */
export function dayKeyOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `Thứ Ba, 24/11/2026`. */
export function dayLabel(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** `Thứ Ba 24/11`: the short form for the picker. */
export function dayShortLabel(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAYS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** `24/11`. */
export function dayMonth(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** `24/11 14:30`: day and clock, for a prompt's time. */
export function dayAndClock(ms: number): string {
  const d = new Date(ms);
  return `${dayMonth(ms)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** One day of the loaded timeline, for the "Đi tới ngày" picker. */
export interface DayOption { dayKey: string; startedAt: number; label: string; prompts: number }

/**
 * The days the loaded events fall on, newest first, with the prompt count of each. A day is the day of the prompt: commands
 * that run after midnight stay in their prompt's day (same rule as `buildTimeline`; a command before any prompt of a Claude
 * Code session counts for its own day).
 */
export function listDays(events: readonly TrainingEventRow[]): DayOption[] {
  const byKey = new Map<string, DayOption>();
  const touch = (e: TrainingEventRow): DayOption => {
    const key = dayKeyOf(e.receivedAt);
    let opt = byKey.get(key);
    if (!opt) { opt = { dayKey: key, startedAt: e.receivedAt, label: dayShortLabel(e.receivedAt), prompts: 0 }; byKey.set(key, opt); }
    return opt;
  };
  let session: string | null = null;
  let inTurn = false;
  for (const e of events) {
    if (e.claudeSessionId !== session) { session = e.claudeSessionId; inTurn = false; }
    if (e.kind === 'prompt') { touch(e).prompts++; inTurn = true; }
    else if (!inTurn) { touch(e); inTurn = true; }
  }
  return [...byKey.values()].sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1));
}

/** The element id of a day strip, to scroll to. */
export const dayElementId = (dayKey: string) => `day-${dayKey}`;
