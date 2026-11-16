import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ActiveSession, SessionDetail } from '../../../../shared/api/index.js';
import { useSessionEvents } from '../../../shared/events/use-session-events.js';
import { buildNotices, markSeenAt, pendingCount, unreadCount, type MentorNotice } from '../domain/mentor-notices.js';
import type { MentorNoticesGateway, SeenStore } from './mentor-notices-gateway.js';

export const MentorNoticesServicesContext = createContext<{ gateway: MentorNoticesGateway; seen: SeenStore } | null>(null);

export interface MentorNoticesState {
  session: { id: number; title: string } | null;
  loaded: boolean; // the active session's detail has arrived (notices reflect it)
  notices: MentorNotice[];
  unread: number;
  pending: number;
  seenAt: number;
  markAllSeen: () => void;
  refresh: () => void;
  /** Let a waiting member in, then refresh. Rejects with the server error. */
  approve: (participantId: number) => Promise<void>;
}

/**
 * Follows the active (lobby/running) session from anywhere in the admin area, so the mentor learns
 * about joins and submissions while on another page. `recheckKey` (the pathname) re-asks which
 * session is active, since only the mentor's own actions open or close one.
 */
export function useMentorNotices(recheckKey: string): MentorNoticesState {
  const services = useContext(MentorNoticesServicesContext);
  if (!services) throw new Error('MentorNoticesServicesContext.Provider is missing above this component');
  const { gateway, seen } = services;
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [seenAt, setSeenAt] = useState(0);
  const seq = useRef(0);

  const checkActive = useCallback(async () => {
    try {
      const a = await gateway.getActive();
      setActive(prev => (prev?.id === a?.id && prev?.status === a?.status ? prev : a));
    } catch { /* transient; the next navigation or event retries */ }
  }, [gateway]);
  useEffect(() => { void checkActive(); }, [checkActive, recheckKey]);

  const activeId = active?.id ?? null;
  const loadDetail = useCallback(async () => {
    if (activeId === null) return;
    const n = ++seq.current;
    try {
      const d = await gateway.getSession(activeId);
      if (n === seq.current) setDetail(d);
    } catch { /* transient */ }
  }, [gateway, activeId]);

  useEffect(() => {
    seq.current++; // drop any in-flight fetch for the previous session
    setDetail(null);
    if (activeId === null) return;
    setSeenAt(seen.load(activeId));
    void loadDetail();
  }, [seen, activeId, loadDetail]);

  useSessionEvents(activeId, {
    participants: loadDetail,
    session: () => { void checkActive(); void loadDetail(); },
  });

  const loaded = detail !== null && detail.id === activeId;
  const notices = useMemo(() => (loaded ? buildNotices(detail.participants) : []), [detail, loaded]);
  const markAllSeen = useCallback(() => {
    if (activeId === null) return;
    const next = markSeenAt(notices, seenAt);
    if (next === seenAt) return;
    setSeenAt(next);
    seen.save(activeId, next);
  }, [seen, activeId, notices, seenAt]);

  return {
    session: active ? { id: active.id, title: active.title } : null,
    loaded,
    notices,
    unread: unreadCount(notices, seenAt),
    pending: loaded ? pendingCount(detail.participants) : 0,
    seenAt,
    markAllSeen,
    refresh: () => void loadDetail(),
    approve: async (participantId: number) => { await gateway.approveParticipant(participantId); void loadDetail(); },
  };
}
