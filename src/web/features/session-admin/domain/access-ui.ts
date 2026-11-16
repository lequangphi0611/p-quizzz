import type { EmailListParse } from '../../../../shared/email-list.js';
import type { OutsiderPolicy, SessionSummary } from '../../../../shared/api/index.js';

/** Who may join a new session, as the server takes it (PRODUCT.md §7.22). */
export type NewSessionAccess = { kind: 'free' } | { kind: 'group'; groupId: number } | { kind: 'emails'; emails: string[] };

/** "Ai được vào?" when creating a session (PRODUCT.md §7.22c). */
export type AccessChoice = 'free' | 'group' | 'temp';

export const ACCESS_CHOICES: readonly { value: AccessChoice; label: string; icon: string; hint: string }[] = [
  { value: 'free', label: 'Tự do', icon: 'door-open', hint: 'Ai có mã phòng cũng vào được, chỉ cần nhập tên.' },
  { value: 'group', label: 'Chỉ nhóm', icon: 'users', hint: 'Chỉ email trong một nhóm đã lưu mới vào được.' },
  { value: 'temp', label: 'Danh sách tạm', icon: 'clipboard-paste', hint: 'Dán danh sách email cho riêng phiên này; lưu thành nhóm được sau.' },
];

export const OUTSIDER_CHOICES: readonly { value: OutsiderPolicy; label: string; hint: string }[] = [
  { value: 'block', label: 'Chặn', hint: 'Người ngoài danh sách không vào được. Họ thấy: "Email này không có trong danh sách của phòng".' },
  { value: 'pending', label: 'Cho xin duyệt', hint: 'Người ngoài danh sách vào hàng chờ, bạn duyệt hoặc từ chối từng người.' },
];

export const isAccessChoice = (v: string | null): v is AccessChoice => v === 'free' || v === 'group' || v === 'temp';

/** What stops creating the session, in the mentor's words ('' = fine). */
export function accessBlocker(choice: AccessChoice, groupId: number | null, tempParse: EmailListParse): string {
  if (choice === 'group' && groupId === null) return 'Chọn một nhóm';
  if (choice === 'temp' && tempParse.valid.length === 0) return 'Dán ít nhất một email hợp lệ';
  return '';
}

export function buildAccess(choice: AccessChoice, groupId: number | null, tempParse: EmailListParse): NewSessionAccess {
  if (choice === 'group' && groupId !== null) return { kind: 'group', groupId };
  if (choice === 'temp') return { kind: 'emails', emails: tempParse.valid.map(v => v.email) };
  return { kind: 'free' };
}

/** What the sessions list shows for who may join. */
export function accessLabel(s: Pick<SessionSummary, 'access' | 'rosterSource'>): string {
  if (s.access === 'free') return 'Tự do';
  return s.rosterSource === 'temp' ? 'Danh sách tạm' : 'Chỉ nhóm';
}

/**
 * The "save this typed list as a group" reminder shows once the session is over, while the list is still unsaved and the
 * mentor has not said "Để sau" (PRODUCT.md §7.22c: the reminder can be put off; the list is never deleted).
 */
export const shouldRemindToSave = (s: Pick<SessionSummary, 'rosterSource' | 'status'>, dismissed: boolean): boolean =>
  s.rosterSource === 'temp' && (s.status === 'closed' || s.status === 'finalized') && !dismissed;
