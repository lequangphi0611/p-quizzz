import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ParticipantReview, SessionDetail } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { useSessionEvents } from '../../../shared/events/use-session-events.js';
import { SessionDetailController, type SessionDetailState } from './session-detail-controller.js';
import type { NewSession, SessionAdminGateway } from './session-admin-gateway.js';

export const SessionAdminGatewayContext = createContext<SessionAdminGateway | null>(null);

export function useSessionAdminGateway(): SessionAdminGateway {
  const g = useContext(SessionAdminGatewayContext);
  if (!g) throw new Error('SessionAdminGatewayContext.Provider is missing above this component');
  return g;
}

/** One controller per loaded session; refetches on the session/participants SSE signals. */
export function useSessionDetail(initial: SessionDetail): { state: SessionDetailState; ctrl: SessionDetailController } {
  const gateway = useSessionAdminGateway();
  const [ctrl] = useState(() => new SessionDetailController(gateway, initial));
  const state = useSyncExternalStore(ctrl.subscribe, ctrl.getState);
  useSessionEvents(initial.id, { session: ctrl.refetch, participants: ctrl.refetch });
  // Who is still connected changes without any event (silence is not a signal), and saving an answer sends none either
  // (PRODUCT.md §7.26: a busy class would reload this page on every click), so look again every few seconds; faster while running.
  const running = state.detail.status === 'running';
  useEffect(() => { const t = setInterval(() => void ctrl.refetch(), running ? 5_000 : 10_000); return () => clearInterval(t); }, [ctrl, running]);
  return { state, ctrl };
}

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/** Create form state: `create` resolves with the new session, or null after setting `error`. */
export function useCreateSession() {
  const gateway = useSessionAdminGateway();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function create(input: NewSession): Promise<SessionDetail | null> {
    if (busy) return null;
    setBusy(true);
    setError('');
    try { return await gateway.createSession(input); }
    catch (err) { setError(errorText(err, 'Không tạo được phiên')); setBusy(false); return null; }
  }
  return { create, busy, error };
}

/** One person's attempt, loaded when selected; a slower earlier load never replaces a newer one. */
export function useParticipantReview(participantId: number): { data: ParticipantReview | null; error: string } {
  const gateway = useSessionAdminGateway();
  const [data, setData] = useState<ParticipantReview | null>(null);
  const [error, setError] = useState('');
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    setData(null);
    setError('');
    gateway.getParticipantReview(participantId)
      .then(r => { if (n === seq.current) setData(r); })
      .catch(err => { if (n === seq.current) setError(errorText(err, 'Không tải được bài làm')); });
  }, [gateway, participantId]);
  return { data, error };
}
