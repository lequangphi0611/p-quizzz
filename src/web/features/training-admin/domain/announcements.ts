import type { TrainingDetail } from '../../../../shared/api/index.js';

const MAX_NAMED = 3;

/**
 * What changed between two loads of a training, in words for a screen reader (`aria-live="polite"`): who started sending,
 * who removed the hook, who still sends after the stop. Empty when nothing worth saying changed. The table itself is not live.
 */
export function announcementFor(prev: TrainingDetail, next: TrainingDetail): string {
  const lines: string[] = [];
  if (prev.status === 'open' && next.status === 'stopped') lines.push('Đã dừng thu');
  if (next.status === 'ended' && prev.status !== 'ended') lines.push('Buổi training đã kết thúc, dữ liệu đã xoá');
  const before = new Map(prev.members.map(m => [m.id, m]));
  for (const m of next.members) {
    const old = before.get(m.id);
    if (!old) { lines.push(`${m.displayName} đã vào buổi`); continue; }
    if (m.stoppedSending && !old.stoppedSending) lines.push(`${m.displayName} đã dừng gửi dữ liệu`);
    else if (m.stillSending && !old.stillSending) lines.push(`${m.displayName} vẫn gửi dữ liệu sau khi dừng thu`);
    else if (m.connection === 'uninstalled' && old.connection !== 'uninstalled' && !m.stillSending) lines.push(`${m.displayName} đã gỡ kết nối`);
    else if (m.connection === 'connected' && old.connection === 'waiting') lines.push(`${m.displayName} đã nhận tín hiệu`);
  }
  if (lines.length <= MAX_NAMED) return lines.join('. ');
  return `${lines.slice(0, MAX_NAMED).join('. ')} và ${lines.length - MAX_NAMED} thay đổi khác`;
}
