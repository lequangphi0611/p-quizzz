import type { EditRequestStatus, RejoinRequestInfo, SessionParticipantDetail } from '../../../../shared/api/index.js';
import type { SessionStartInfo } from '../../../../shared/session-start.js';

// Mentor notifications are derived from the session detail (no extra storage on the server):
// every non-kicked participant yields a "joined" notice, plus a "submitted" notice once they hand in.
export type NoticeKind = 'pending' | 'joined' | 'submitted' | 'edit' | 'rejoin' | 'start-soon' | 'start-dropped';

/** The start of a session (PRODUCT.md §7.31g): it is about to start by itself while people still wait, or its time was dropped. */
export interface StartNoticeFacts {
  start: SessionStartInfo | null;
  pendingCount: number;
  startScheduleDroppedAt: number | null;
}

/** "Sắp tự bắt đầu" shows in the last minute before the scheduled time. */
export const START_SOON_MS = 60_000;

/** A request to take over a seat (PRODUCT.md §7.23): who holds it now and whether they are still connected. Mentor only. */
export interface RejoinNoticeInfo {
  requestId: number;
  holderName: string;
  holderEmail: string | null;
  holderOnline: boolean;
  holderLastSeenAt: number | null;
  claimantName: string;
}

/** Which session a notice belongs to: several may be open at once (PRODUCT.md §7.5), so every notice says. */
export interface SessionLabel {
  id: number;
  name: string;
  slot: number | null;
}

export interface MentorNotice {
  key: string; // stable across refetches, e.g. "join:12" (participant ids are unique across sessions)
  kind: NoticeKind;
  sessionId: number;
  sessionName: string;
  slot: number | null;
  participantId: number;
  displayName: string;
  at: number; // server epoch ms
  /** `edit` notices (PRODUCT.md §7.21): where the member's request stands, and why they asked. */
  editStatus?: EditRequestStatus;
  reason?: string;
  resolvedAt?: number | null; // when the mentor answered; shown next to the outcome
  /** `rejoin` notices: the request and who holds the seat. */
  rejoin?: RejoinNoticeInfo;
  /** `start-soon`: how many still wait for approval, and the scheduled time (epoch ms). */
  waiting?: number;
  startAt?: number;
}

const NO_SESSION: SessionLabel = { id: 0, name: '', slot: null };

/** Newest first; at the same instant a submission sorts above a join. */
export function buildNotices(participants: readonly SessionParticipantDetail[], session: SessionLabel = NO_SESSION, rejoinRequests: readonly RejoinRequestInfo[] = [], start?: StartNoticeFacts): MentorNotice[] {
  const out: MentorNotice[] = [];
  const base = { sessionId: session.id, sessionName: session.name, slot: session.slot };
  // Session-level notices about the start (no participant: id 0). Times come from the server's own clock.
  const s = start?.start;
  if (s && s.scheduledAt !== null && s.startsAt === s.scheduledAt && s.startsInMs !== null && s.startsInMs > 0 && s.startsInMs <= START_SOON_MS && start!.pendingCount > 0) {
    out.push({ ...base, key: `start-soon:${session.id}:${s.scheduledAt}`, kind: 'start-soon', participantId: 0, displayName: `Phòng “${session.name}”`, at: s.scheduledAt - START_SOON_MS, waiting: start!.pendingCount, startAt: s.scheduledAt });
  }
  if (start?.startScheduleDroppedAt) {
    out.push({ ...base, key: `start-dropped:${session.id}:${start.startScheduleDroppedAt}`, kind: 'start-dropped', participantId: 0, displayName: `Giờ hẹn của phòng “${session.name}”`, at: start.startScheduleDroppedAt });
  }
  for (const p of participants) {
    if (p.status === 'kicked') continue;
    out.push({ ...base, key: `join:${p.id}`, kind: p.status === 'pending' ? 'pending' : 'joined', participantId: p.id, displayName: p.displayName, at: p.joinedAt });
    if (p.progress.submittedAt !== null) {
      out.push({ ...base, key: `submit:${p.id}`, kind: 'submitted', participantId: p.id, displayName: p.displayName, at: p.progress.submittedAt });
    }
    const edit = p.progress.editRequest;
    if (edit) out.push({ ...base, key: `edit:${p.id}:${edit.requestedAt}`, kind: 'edit', participantId: p.id, displayName: p.displayName, at: edit.requestedAt, editStatus: edit.status, reason: edit.reason, resolvedAt: edit.resolvedAt });
  }
  const holders = new Map(participants.map(p => [p.id, p]));
  for (const r of rejoinRequests) {
    const holder = holders.get(r.participantId);
    out.push({ ...base, key: `rejoin:${r.id}`, kind: 'rejoin', participantId: r.participantId, displayName: r.claimantName, at: r.requestedAt,
      rejoin: { requestId: r.id, holderName: holder?.displayName ?? '—', holderEmail: holder?.email ?? null, holderOnline: holder?.connection.online ?? false, holderLastSeenAt: holder?.connection.lastSeenAt ?? null, claimantName: r.claimantName } });
  }
  return out.sort((a, b) => b.at - a.at || rank(a) - rank(b) || b.participantId - a.participantId);
}
const rank = (n: MentorNotice) => (n.kind === 'submitted' ? 0 : 1);

/** The "seen" mark: one number (a single session), or one per session id (several open at once). */
export type Seen = number | Readonly<Record<number, number>>;
const seenFor = (seen: Seen, sessionId: number) => (typeof seen === 'number' ? seen : seen[sessionId] ?? 0);

/** Notices newer than the last time the mentor opened the list. */
export const unreadCount = (notices: readonly MentorNotice[], seen: Seen) => notices.filter(n => n.at > seenFor(seen, n.sessionId)).length;

/** All sessions' notices as one list, newest first. Each session is built with its own label. */
export function buildAllNotices(entries: readonly { session: SessionLabel; participants: readonly SessionParticipantDetail[]; rejoinRequests?: readonly RejoinRequestInfo[]; start?: StartNoticeFacts }[]): MentorNotice[] {
  return entries
    .flatMap(e => buildNotices(e.participants, e.session, e.rejoinRequests, e.start))
    .sort((a, b) => b.at - a.at || rank(a) - rank(b) || b.participantId - a.participantId);
}

export const pendingCount = (participants: readonly SessionParticipantDetail[]) => participants.filter(p => p.status === 'pending').length;

/** Members waiting for an answer to "xin sửa bài". */
export const editPendingCount = (participants: readonly SessionParticipantDetail[]) => participants.filter(p => p.status !== 'kicked' && p.progress.editRequest?.status === 'pending').length;

/**
 * The "seen" mark is the newest notice time, not Date.now(): both sides of the comparison then come
 * from the server clock, so a skewed browser clock cannot hide or resurrect notices.
 */
export function markSeenAt(notices: readonly MentorNotice[], seen: number): number;
export function markSeenAt(notices: readonly MentorNotice[], seen: Readonly<Record<number, number>>): Readonly<Record<number, number>>;
export function markSeenAt(notices: readonly MentorNotice[], seen: Seen): Seen {
  if (typeof seen === 'number') return Math.max(seen, ...notices.map(n => n.at));
  const next: Record<number, number> = { ...seen };
  let changed = false;
  for (const n of notices) if (n.at > (next[n.sessionId] ?? 0)) { next[n.sessionId] = n.at; changed = true; }
  return changed ? next : seen; // same reference when nothing moved, so callers can skip saving
}

export const NOTICE_TEXT: Record<NoticeKind, { text: string; icon: string; color: string }> = {
  pending: { text: 'xin vào phiên, đang chờ duyệt', icon: 'user-plus', color: 'var(--sun-ink)' },
  joined: { text: 'đã vào phiên', icon: 'user-check', color: 'var(--brand-700)' },
  submitted: { text: 'đã nộp bài', icon: 'send', color: 'var(--correct-600)' },
  edit: { text: 'xin sửa bài tự luận', icon: 'pencil', color: 'var(--sun-ink)' },
  rejoin: { text: 'xin vào lại', icon: 'door-open', color: 'var(--sun-ink)' },
  'start-soon': { text: 'sắp tự bắt đầu', icon: 'play', color: 'var(--sun-ink)' },
  'start-dropped': { text: 'đã bị bỏ vì máy khởi động lại sau giờ hẹn', icon: 'triangle-alert', color: 'var(--warn-600)' },
};

/** Something only the mentor can unblock: a person waiting at the door, or a request to edit essays. */
export const needsAttention = (n: MentorNotice) => n.kind === 'pending' || n.kind === 'rejoin' || n.kind === 'start-soon' || n.kind === 'start-dropped' || (n.kind === 'edit' && n.editStatus === 'pending');

/** Items that need the mentor first (still newest first inside each group). */
export const attentionFirst = (notices: readonly MentorNotice[]): MentorNotice[] => [...notices.filter(needsAttention), ...notices.filter(n => !needsAttention(n))];

/** The outcome shown on an `edit` notice once it is no longer waiting for the mentor. */
export const EDIT_OUTCOME: Record<Exclude<EditRequestStatus, 'pending'>, { label: string; color: string; icon: string }> = {
  approved: { label: 'Đã duyệt', color: 'var(--correct-600)', icon: 'circle-check' },
  done: { label: 'Đã duyệt · đã sửa xong', color: 'var(--correct-600)', icon: 'circle-check' },
  rejected: { label: 'Đã từ chối', color: 'var(--ink-700)', icon: 'x' },
  expired: { label: 'Hết hiệu lực — phiên đã đóng', color: 'var(--ink-600)', icon: 'lock' },
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
