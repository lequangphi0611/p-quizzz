import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { SessionDetail, SessionSummary } from '../../../../shared/api/index.js';
import { useAdminEvents } from '../../../shared/events/use-session-events.js';
import { buildAllNotices, editPendingCount, markSeenAt, pendingCount, unreadCount, type MentorNotice } from '../domain/mentor-notices.js';
import type { MentorNoticesGateway, SeenStore } from './mentor-notices-gateway.js';

export const MentorNoticesServicesContext = createContext<{ gateway: MentorNoticesGateway; seen: SeenStore } | null>(null);

/** What the bell needs to know about one open session. */
export interface OpenSessionNotices {
  id: number;
  name: string;
  slot: number | null;
  title: string; // exam title
  status: SessionSummary['status'];
  pending: number;
  editPending: number;
  /** Requests to take over a seat, waiting for the mentor. */
  rejoinPending: number;
  unread: number;
}

export interface MentorNoticesState {
  /** Sessions in lobby/running, lowest slot first. */
  sessions: OpenSessionNotices[];
  loaded: boolean; // every open session's detail has arrived (notices reflect them)
  /** All open sessions' notices, newest first; each says which session it belongs to. */
  notices: MentorNotice[];
  unread: number;
  /** Members waiting at the door, across all open sessions. */
  pending: number;
  /** Members waiting for an answer to "xin sửa bài". */
  editPending: number;
  /** Requests to take over a seat, across all open sessions. */
  rejoinPending: number;
  /** Rejoin requests this browser answered, newest first: a short "trước đó" trail that lives as long as the page (nothing is stored). */
  handledRejoin: HandledRejoin[];
  /** Per-session "seen" marks (the newest notice time the mentor has looked at). */
  seen: Readonly<Record<number, number>>;
  markAllSeen: () => void;
  refresh: () => void;
  /** Let a waiting member in, then refresh. Rejects with the server error. */
  approve: (participantId: number) => Promise<void>;
  /** Approve or reject a request to edit essays, then refresh. Rejects with the server error. */
  resolveEdit: (participantId: number, decision: 'approve' | 'reject') => Promise<void>;
  /** Answer a request to take over a seat, then refresh. Rejects with the server error. */
  answerRejoin: (notice: MentorNotice, answer: 'keep' | 'takeover' | 'reject') => Promise<void>;
}

export interface HandledRejoin { key: string; sessionId: number; sessionName: string; text: string; at: number }

/**
 * Follows EVERY open (lobby/running) session from anywhere in the admin area, so the mentor learns about joins and
 * submissions while on another page. Several sessions may run at once (PRODUCT.md §7.5): one stream for all of them
 * says which session changed, and `recheckKey` (the pathname) re-asks which sessions are open.
 */
export function useMentorNotices(recheckKey: string): MentorNoticesState {
  const services = useContext(MentorNoticesServicesContext);
  if (!services) throw new Error('MentorNoticesServicesContext.Provider is missing above this component');
  const { gateway, seen: seenStore } = services;
  const [open, setOpen] = useState<SessionSummary[]>([]);
  const [details, setDetails] = useState<Record<number, SessionDetail>>({});
  const [seen, setSeen] = useState<Record<number, number>>({});
  const [handledRejoin, setHandledRejoin] = useState<HandledRejoin[]>([]);
  const openRef = useRef<SessionSummary[]>([]);
  const seq = useRef<Record<number, number>>({});

  const loadOpen = useCallback(async () => {
    try {
      const list = await gateway.listActive();
      const same = list.length === openRef.current.length && list.every((s, i) => { const p = openRef.current[i]!; return p.id === s.id && p.status === s.status && p.name === s.name && p.slot === s.slot; });
      if (!same) { openRef.current = list; setOpen(list); }
    } catch { /* transient; the next navigation or event retries */ }
  }, [gateway]);
  useEffect(() => { void loadOpen(); }, [loadOpen, recheckKey]);

  const loadDetail = useCallback(async (id: number) => {
    const n = (seq.current[id] = (seq.current[id] ?? 0) + 1);
    try {
      const d = await gateway.getSession(id);
      if (n === seq.current[id]) setDetails(prev => ({ ...prev, [id]: d }));
    } catch { /* transient */ }
  }, [gateway]);

  // A session that just opened gets its detail and its "seen" mark; one that closed is forgotten.
  useEffect(() => {
    const ids = new Set(open.map(s => s.id));
    setDetails(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => ids.has(Number(id)))));
    setSeen(prev => {
      const next = { ...prev };
      for (const id of ids) if (next[id] === undefined) next[id] = seenStore.load(id);
      for (const k of Object.keys(next)) if (!ids.has(Number(k))) delete next[Number(k)];
      return next;
    });
    for (const s of open) void loadDetail(s.id);
  }, [open, seenStore, loadDetail]);

  useAdminEvents({
    onEvent: (type, sessionId) => {
      if (type === 'session') void loadOpen();
      if (openRef.current.some(s => s.id === sessionId)) void loadDetail(sessionId);
    },
    onResync: () => { void loadOpen(); for (const s of openRef.current) void loadDetail(s.id); },
  });
  // Who is connected changes without any signal (silence is not an event), so the holder's status in a request is refreshed on a
  // timer. Nobody is looking while the tab is hidden, so it rests then and catches up the moment the tab is shown again.
  useEffect(() => {
    const refresh = () => { if (!document.hidden) for (const s of openRef.current) void loadDetail(s.id); };
    const t = setInterval(refresh, 15_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', refresh); };
  }, [loadDetail]);

  const loaded = open.every(s => details[s.id]?.id === s.id);
  const notices = useMemo(
    () => buildAllNotices(open.flatMap(s => (details[s.id] ? [{ session: { id: s.id, name: s.name, slot: s.slot }, participants: details[s.id]!.participants, rejoinRequests: details[s.id]!.rejoinRequests }] : []))),
    [open, details],
  );
  const markAllSeen = useCallback(() => {
    const next = markSeenAt(notices, seen);
    if (next === seen) return;
    setSeen(next);
    for (const [id, at] of Object.entries(next)) if (at !== seen[Number(id)]) seenStore.save(Number(id), at);
  }, [seenStore, notices, seen]);

  const sessions: OpenSessionNotices[] = open.map(s => {
    const d = details[s.id];
    return {
      id: s.id, name: s.name, slot: s.slot, title: s.examTitle, status: s.status,
      pending: d ? pendingCount(d.participants) : 0,
      editPending: d ? editPendingCount(d.participants) : 0,
      rejoinPending: d ? d.rejoinRequests.length : 0,
      unread: unreadCount(notices.filter(n => n.sessionId === s.id), seen),
    };
  });
  const refreshAll = () => { for (const s of openRef.current) void loadDetail(s.id); };

  return {
    sessions,
    loaded,
    notices,
    unread: unreadCount(notices, seen),
    pending: sessions.reduce((sum, s) => sum + s.pending, 0),
    editPending: sessions.reduce((sum, s) => sum + s.editPending, 0),
    rejoinPending: sessions.reduce((sum, s) => sum + s.rejoinPending, 0),
    handledRejoin,
    seen,
    markAllSeen,
    refresh: refreshAll,
    approve: async (participantId: number) => { await gateway.approveParticipant(participantId); refreshAll(); },
    resolveEdit: async (participantId: number, decision: 'approve' | 'reject') => { await gateway.resolveEditRequest(participantId, decision); refreshAll(); },
    answerRejoin: async (notice: MentorNotice, answer: 'keep' | 'takeover' | 'reject') => {
      if (!notice.rejoin) return;
      await gateway.answerRejoin(notice.rejoin.requestId, answer);
      const verb = answer === 'keep' ? `đã cho “${notice.rejoin.claimantName}” vào lại` : answer === 'takeover' ? `đã mời “${notice.rejoin.holderName}” ra, cho “${notice.rejoin.claimantName}” vào` : `đã từ chối “${notice.rejoin.claimantName}”`;
      setHandledRejoin(prev => [{ key: notice.key, sessionId: notice.sessionId, sessionName: notice.sessionName, text: `Bạn ${verb}`, at: Date.now() }, ...prev].slice(0, 20));
      refreshAll();
    },
  };
}
