/** The days of an export, as the mentor's calendar sees them (PRODUCT.md §7.36a). */
export interface ExportRange {
  /** First and last day, YYYY-MM-DD. */
  fromDay: string;
  toDay: string;
  /** Local midnight of `fromDay` (inclusive) and of the day after `toDay` (exclusive). */
  from: Date;
  to: Date;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

/**
 * No days given = today; `from` alone = that single day. Days are local to the machine running the app, which is the mentor's:
 * `from` 00:00 up to, not including, 00:00 of the day after `to`. The query is validated before this (`TrainingExportQuery`).
 */
export function resolveExportRange(input: { from?: string; to?: string }, now: Date): ExportRange {
  const fromDay = input.from ?? dayKey(now);
  const toDay = input.to ?? fromDay;
  const first = parseDay(fromDay);
  const last = parseDay(toDay);
  return { fromDay, toDay, from: first, to: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1) };
}

/** "24/11/2026" or "24/11/2026 – 26/11/2026". */
export function describeExportRange(range: Pick<ExportRange, 'fromDay' | 'toDay'>): string {
  const show = (day: string) => day.split('-').reverse().join('/');
  return range.fromDay === range.toDay ? show(range.fromDay) : `${show(range.fromDay)} – ${show(range.toDay)}`;
}
