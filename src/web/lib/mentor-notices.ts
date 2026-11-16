import type { SessionParticipantDetail } from '../../shared/api/index.js';

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

// Per-session "seen" mark in localStorage. Storage can throw (private mode) — never break the UI.
const seenKey = (sessionId: number) => `pq:mentor:notices-seen:${sessionId}`;
export function loadSeenAt(sessionId: number): number {
  try { return Number(localStorage.getItem(seenKey(sessionId))) || 0; } catch { return 0; }
}
export function saveSeenAt(sessionId: number, at: number) {
  try { localStorage.setItem(seenKey(sessionId), String(at)); } catch { /* ignore */ }
}
