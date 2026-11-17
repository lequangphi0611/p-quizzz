// Countdown text and stages for the session time limit (PRODUCT.md §7.27). Pure, tested.

/** Reminders: members are told when 5 minutes and 1 minute remain. */
export const SOON_MS = 5 * 60_000;
export const LAST_MS = 60_000;

export type CountdownLevel = 'normal' | 'soon' | 'last' | 'up';

export function countdownLevel(ms: number): CountdownLevel {
  if (ms <= 0) return 'up';
  if (ms <= LAST_MS) return 'last';
  if (ms <= SOON_MS) return 'soon';
  return 'normal';
}

/** "29:59", "1:05:00". Rounds up, so the clock shows 00:01 until the very last second and 00:00 only at the end. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

/** "45 phút", "1 giờ 30 phút". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}

/** Screen-reader sentence for a reminder (the visible clock itself is not announced every second). */
export function reminderText(level: CountdownLevel): string | null {
  if (level === 'soon') return 'Còn 5 phút làm bài.';
  if (level === 'last') return 'Còn 1 phút làm bài.';
  if (level === 'up') return 'Đã hết giờ làm bài.';
  return null;
}
