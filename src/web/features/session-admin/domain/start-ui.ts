// The mentor's "Bắt đầu" card (PRODUCT.md §7.31). Pure, tested.
import type { SessionDetail } from '../../../../shared/api/index.js';
import { formatClockTime } from '../../../shared/format/start.js';

/**
 * The next moment with this time of day ("HH:MM" from a time input): today if it is still ahead, otherwise tomorrow.
 * Null for an unreadable value.
 */
export function nextOccurrence(hhmm: string, now: Date): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at;
}

/** "9:00", or "9:00 ngày mai" when the time falls on the next day. */
export function scheduleLabel(at: number, now: Date): string {
  const d = new Date(at);
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? formatClockTime(at) : `${formatClockTime(at)} ngày mai`;
}

/** "HH:MM" for the time input, from a scheduled start. */
export const toTimeInput = (at: number): string => {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Default least number of people: the list of a roster session, otherwise the people in the room (at least 1). */
export function defaultReadyMin(d: Pick<SessionDetail, 'roster' | 'participants'>): number {
  if (d.roster) return Math.max(1, d.roster.size);
  return Math.max(1, d.participants.filter(p => p.status === 'active').length);
}

export interface Blocker { icon: string; text: string }

/**
 * Why "everyone ready" has not started the countdown yet (PRODUCT.md §7.31e), for the mentor only. Names the people who
 * lost their connection without being ready: they still count, so the mentor may kick them or start by hand.
 */
export function autoStartBlockers(d: Pick<SessionDetail, 'start' | 'participants' | 'pendingCount'>): Blocker[] {
  const s = d.start;
  if (!s || !s.autoStartReady) return [];
  const out: Blocker[] = [];
  const { count, total } = s.ready;
  if (s.readyMin !== null && total < s.readyMin) out.push({ icon: 'users', text: `Cần tối thiểu ${s.readyMin} người (đang có ${total})` });
  if (count < total) out.push({ icon: 'user-check', text: `Mới ${count}/${total} sẵn sàng` });
  if (d.pendingCount > 0) out.push({ icon: 'hourglass', text: `Đang chờ duyệt ${d.pendingCount} người` });
  for (const p of d.participants) {
    if (p.status === 'active' && p.readyAt === null && !p.connection.online && p.connection.lastSeenAt !== null) {
      out.push({ icon: 'wifi-off', text: `${p.displayName} mất kết nối từ ${formatClockTime(p.connection.lastSeenAt)} — vẫn tính vào ${total}` });
    }
  }
  return out;
}

/** "Bắt đầu ngay" before the scheduled time of a timed session: whoever is not seated yet loses time (§7.31c). */
export function earlyStartWarning(d: Pick<SessionDetail, 'start' | 'timeLimitMinutes'>, now: number): string | null {
  const at = d.start?.scheduledAt ?? null;
  if (at === null || at <= now || d.timeLimitMinutes === null) return null;
  return `Bắt đầu sớm hơn giờ hẹn (${formatClockTime(at)})? Phiên giới hạn ${d.timeLimitMinutes} phút tính từ lúc bắt đầu; ai chưa ngồi vào chỗ sẽ mất giờ làm bài.`;
}
