import type { SessionParticipantDetail } from '../../../../shared/api/index.js';

// Mentor notifications are derived from the session detail (no extra storage on the server):
// every non-kicked participant yields a "joined" notice, plus a "submitted" notice once they hand in.
export type NoticeKind = 'pending' | 'joined' | 'submitted';

export interface MentorNotice {
  key: string; // stable across refetches, e.g. "join:12"
  kind: NoticeKind;
  participantId: number;
  displayName: string;
  at: number; // server epoch ms
}

/** Newest first; at the same instant a submission sorts above a join. */
export function buildNotices(participants: readonly SessionParticipantDetail[]): MentorNotice[] {
  const out: MentorNotice[] = [];
  for (const p of participants) {
    if (p.status === 'kicked') continue;
    out.push({ key: `join:${p.id}`, kind: p.status === 'pending' ? 'pending' : 'joined', participantId: p.id, displayName: p.displayName, at: p.joinedAt });
    if (p.progress.submittedAt !== null) {
      out.push({ key: `submit:${p.id}`, kind: 'submitted', participantId: p.id, displayName: p.displayName, at: p.progress.submittedAt });
    }
  }
  return out.sort((a, b) => b.at - a.at || rank(a) - rank(b) || b.participantId - a.participantId);
}
const rank = (n: MentorNotice) => (n.kind === 'submitted' ? 0 : 1);

/** Notices newer than the last time the mentor opened the list. */
export const unreadCount = (notices: readonly MentorNotice[], seenAt: number) => notices.filter(n => n.at > seenAt).length;

export const pendingCount = (participants: readonly SessionParticipantDetail[]) => participants.filter(p => p.status === 'pending').length;

/**
 * The "seen" mark is the newest notice time, not Date.now(): both sides of the comparison then come
 * from the server clock, so a skewed browser clock cannot hide or resurrect notices.
 */
export const markSeenAt = (notices: readonly MentorNotice[], seenAt: number) => Math.max(seenAt, ...notices.map(n => n.at));

export const NOTICE_TEXT: Record<NoticeKind, { text: string; icon: string; color: string }> = {
  pending: { text: 'xin vào phiên, đang chờ duyệt', icon: 'user-plus', color: 'var(--sun-ink)' },
  joined: { text: 'đã vào phiên', icon: 'user-check', color: 'var(--brand-700)' },
  submitted: { text: 'đã nộp bài', icon: 'send', color: 'var(--correct-600)' },
};

/** "(3) p-quizzz" so the mentor sees new activity from another tab. */
export const titleWithCount = (base: string, count: number) => (count > 0 ? `(${count > 99 ? '99+' : count}) ${base}` : base);

// ── Desktop (OS) notifications for pending joiners (PRODUCT.md §7.20) ──────────────────────────
/**
 * Pending-join notices that appeared since the previous snapshot. `known` is null on the first
 * snapshot of a session: people already waiting then are shown in the bell, not announced again.
 */
export function newPendingNotices(known: ReadonlySet<string> | null, notices: readonly MentorNotice[]): MentorNotice[] {
  if (known === null) return [];
  return notices.filter(n => n.kind === 'pending' && !known.has(n.key));
}

export const DESKTOP_BATCH_MAX = 3; // more new joiners at once → one summary instead of a burst
export const DESKTOP_BURST_MS = 15_000; // after a pop, later joiners update one summary instead of stacking up

/**
 * One entry per notification to show. `tag` lets the OS de-duplicate across open admin tabs, and the
 * shared summary tag replaces the previous summary. `inBurst` = a notification was shown moments ago
 * (people trickle into a lobby one request at a time, so batching alone would not catch it).
 */
export function desktopNotifications(fresh: readonly MentorNotice[], totalPending: number, inBurst = false): { title: string; body: string; tag: string }[] {
  if (!fresh.length) return [];
  if (inBurst || fresh.length > DESKTOP_BATCH_MAX) {
    const latest = fresh.slice(0, DESKTOP_BATCH_MAX).map(n => n.displayName).join(', ') + (fresh.length > DESKTOP_BATCH_MAX ? '…' : '');
    return [{ title: `${totalPending} người đang chờ duyệt`, body: `Mới vào: ${latest}. Bấm để mở phiên.`, tag: 'pq-pending-summary' }];
  }
  const body = `${totalPending} người đang chờ duyệt. Bấm để mở phiên.`;
  return fresh.map(n => ({ title: `${n.displayName} xin vào phiên`, body, tag: `pq-pending-${n.participantId}` }));
}
