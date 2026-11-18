// Labels and change notices for how a session starts (PRODUCT.md §7.31). Pure, tested.
import type { SessionStartInfo } from '../../../shared/session-start.js';

/** "9:00", "14:05": the time of day a start is planned for, on this device. */
export function formatClockTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Who decides when the session starts, for the line under "Sẵn sàng X/Y". */
export type StartRule = 'manual' | 'scheduled' | 'auto' | 'manualAuto';

export function startRuleOf(s: Pick<SessionStartInfo, 'scheduledAt' | 'autoStartReady'>): StartRule {
  if (s.scheduledAt !== null) return s.autoStartReady ? 'auto' : 'scheduled';
  return s.autoStartReady ? 'manualAuto' : 'manual';
}

/** Why the 10-second countdown runs: the mentor pressed "Bắt đầu ngay" (early when before the scheduled time), or everyone is ready. */
export type CountReason = 'mentor' | 'all' | 'early';

export function countReasonOf(s: Pick<SessionStartInfo, 'countdownSource' | 'early'>): CountReason {
  if (s.countdownSource === 'ready') return 'all';
  return s.early ? 'early' : 'mentor';
}

export type StartNoticeKind = 'time' | 'cleared' | 'cancel';

export interface StartNotice {
  id: number;
  kind: StartNoticeKind;
  title: string;
  sub: string | null;
  /** How many changes this card stands for ("đổi 3 lần"). */
  count: number;
  /** Device time of the last change it shows. */
  at: number;
  /** The scheduled times seen, oldest first (kind `time` only). */
  trail: number[];
}

/** Changes of the same kind this close together update one card instead of stacking new ones. */
export const NOTICE_MERGE_MS = 60_000;

/**
 * The notices after one refetch: what changed between `prev` and `next` (both while the session waits to start). Never
 * says why (PRODUCT.md §7.31h). Newest first. Starting (next = null) is not a notice: the screen moves on by itself.
 */
export function nextStartNotices(prev: SessionStartInfo | null, next: SessionStartInfo | null, notices: StartNotice[], now: number, newId: () => number): StartNotice[] {
  if (!prev || !next) return notices;
  let list = notices;
  if (prev.scheduledAt !== next.scheduledAt) {
    if (next.scheduledAt === null) {
      list = [{ id: newId(), kind: 'cleared', title: next.autoStartReady ? 'Mentor đã bỏ giờ hẹn' : 'Mentor đã bỏ giờ hẹn, chờ mentor bắt đầu', sub: prev.scheduledAt !== null ? `Trước đó: ${formatClockTime(prev.scheduledAt)}.` : null, count: 1, at: now, trail: [] }, ...list.filter(n => n.kind !== 'time')];
    } else if (prev.scheduledAt === null) {
      list = [{ id: newId(), kind: 'time', title: `Mentor đã hẹn bắt đầu lúc ${formatClockTime(next.scheduledAt)}`, sub: null, count: 1, at: now, trail: [next.scheduledAt] }, ...list.filter(n => n.kind !== 'cleared')];
    } else {
      const same = list.find(n => n.kind === 'time' && now - n.at <= NOTICE_MERGE_MS && n.trail.length > 0);
      const trail = same ? [...same.trail, next.scheduledAt] : [prev.scheduledAt, next.scheduledAt];
      const count = trail.length - 1;
      const notice: StartNotice = {
        id: same?.id ?? newId(),
        kind: 'time',
        title: `Giờ bắt đầu đã đổi sang ${formatClockTime(next.scheduledAt)}`,
        sub: count > 1 ? `${trail.map(formatClockTime).join(' → ')}. Chỉ giờ mới nhất có hiệu lực.` : `Trước đó: ${formatClockTime(prev.scheduledAt)}.`,
        count,
        at: now,
        trail,
      };
      list = [notice, ...list.filter(n => n !== same)];
    }
  }
  // Neutral wording: the server also clears a countdown that went overdue while it was down, which the mentor did not do.
  if (prev.countdownEndsAt !== null && next.countdownEndsAt === null) {
    list = [{ id: newId(), kind: 'cancel', title: 'Đếm ngược đã dừng', sub: 'Phiên chưa bắt đầu.', count: 1, at: now, trail: [] }, ...list.filter(n => n.kind !== 'cancel')];
  }
  return list;
}
