import type { TrainingExportSummary } from '../../../../shared/api/index.js';

/** The days the mentor picks in the export dialog (PRODUCT.md §7.36a): today by the app's clock, one day, or from one day to another. */
export type ExportMode = 'today' | 'day' | 'range';

/** What goes to the server. `memberIds` null = the whole class; without `from` the server takes today. */
export interface ExportParams {
  from?: string;
  to?: string;
  memberIds: readonly number[] | null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The query string for the summary and the zip, `''` or `?from=…&to=…&members=1,2`. */
export function exportQueryString(p: ExportParams): string {
  const parts: string[] = [];
  if (p.from) parts.push(`from=${p.from}`);
  if (p.to) parts.push(`to=${p.to}`);
  if (p.memberIds) parts.push(`members=${p.memberIds.join(',')}`);
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

/** Params for what the dialog shows. `from` / `to` are `YYYY-MM-DD` as a date input gives them. */
export function paramsFor(mode: ExportMode, from: string, to: string, memberIds: readonly number[] | null): ExportParams {
  if (mode === 'today') return { memberIds };
  if (mode === 'day') return { from, memberIds };
  return { from, to, memberIds };
}

/** Why the choice cannot be exported yet, in the mentor's words; null when it can. Checked before asking the server. */
export function exportInputError(mode: ExportMode, from: string, to: string, memberIds: readonly number[] | null): string | null {
  if (memberIds !== null && memberIds.length === 0) return 'Chọn ít nhất một bạn';
  if (mode === 'today') return null;
  if (!DAY.test(from)) return mode === 'day' ? 'Chọn ngày' : 'Chọn ngày bắt đầu';
  if (mode === 'range') {
    if (!DAY.test(to)) return 'Chọn ngày kết thúc';
    if (to < from) return 'Ngày kết thúc phải sau hoặc cùng ngày bắt đầu';
  }
  return null;
}

/** `du-lieu-buoi-1-2026-11-24.zip` or `…-2026-11-22_2026-11-24.zip`: the name without accents, spaces and symbols, safe on any file system. */
export function exportFileName(trainingName: string, from: string, to: string): string {
  const slug = trainingName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return `du-lieu-${slug || 'training'}-${from === to ? from : `${from}_${to}`}.zip`;
}

/** "1,4 MB", "820 KB", "120 byte": what the dialog shows before the download. Rounded up, so it never promises less than there is. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} byte`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.ceil(kb)} KB`;
  return `${(Math.ceil((kb / 1024) * 10) / 10).toFixed(1).replace('.', ',')} MB`;
}

/** "24/11/2026" or "22/11/2026 – 24/11/2026" from the days the server used. */
export function describeDays(s: Pick<TrainingExportSummary, 'from' | 'to'>): string {
  const show = (day: string) => day.split('-').reverse().join('/');
  return s.from === s.to ? show(s.from) : `${show(s.from)} – ${show(s.to)}`;
}
