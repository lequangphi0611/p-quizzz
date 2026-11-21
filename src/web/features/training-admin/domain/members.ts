import type { TrainingDetail, TrainingMemberRow } from '../../../../shared/api/index.js';

const NAME_ORDER = new Intl.Collator('vi', { sensitivity: 'base', numeric: true });

/**
 * The member table is sorted by name and stays that way: no sorting by errors or anything else (PRODUCT.md §7.34, this is
 * not a ranking). Equal names fall back to the join order, so the order never jumps while data refreshes.
 */
export const sortMembers = (members: readonly TrainingMemberRow[]): TrainingMemberRow[] =>
  [...members].sort((a, b) => NAME_ORDER.compare(a.displayName, b.displayName) || a.id - b.id);

/** How many machines still send after "Dừng thu". Only a count: the names are in the table. */
export const stillSendingCount = (members: readonly TrainingMemberRow[]): number => members.filter(m => m.stillSending).length;

export interface UninstallProgress { done: number; total: number; stillSending: number }

/** "Đã gỡ X/N" and "Còn N máy vẫn gửi"; null while the training is not stopped. */
export function uninstallProgress(detail: Pick<TrainingDetail, 'uninstalled' | 'members'>): UninstallProgress | null {
  if (!detail.uninstalled) return null;
  return { done: detail.uninstalled.count, total: detail.uninstalled.total, stillSending: stillSendingCount(detail.members) };
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const clock = (ms: number) => `${pad2(new Date(ms).getHours())}:${pad2(new Date(ms).getMinutes())}`;
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/** "14:36" today, "20/11 14:36" on another day, "—" when nothing was ever heard from the member. */
export function formatLastSeen(ms: number | null, now: number): string {
  if (ms === null) return '—';
  if (sameDay(ms, now)) return clock(ms);
  const d = new Date(ms);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${clock(ms)}`;
}

/** "6 prompt · 18 lệnh · 5 lỗi" */
export const memberCountsText = (m: Pick<TrainingMemberRow, 'promptCount' | 'toolCount' | 'failedCount'>): string =>
  `${m.promptCount} prompt · ${m.toolCount} lệnh · ${m.failedCount} lỗi`;

/** "2 /clear · 1 lần nén · 4 lần xin quyền": what is not a prompt or a command; parts that are zero are left out. Empty when there is nothing. */
export const memberExtraCountsText = (m: Pick<TrainingMemberRow, 'clearCount' | 'compactCount' | 'permissionCount'>): string =>
  [m.clearCount > 0 && `${m.clearCount} lần /clear`, m.compactCount > 0 && `${m.compactCount} lần nén`, m.permissionCount > 0 && `${m.permissionCount} lần xin quyền`].filter(Boolean).join(' · ');
