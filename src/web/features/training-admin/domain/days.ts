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
