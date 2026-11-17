import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { LeaderboardResponse } from '../../../shared/api/index.js';
import { useSessionEvents } from '../events/use-session-events.js';
import type { LeaderboardGateway } from './leaderboard-gateway.js';
import { LeaderboardView } from './LeaderboardView.js';

export const LeaderboardGatewayContext = createContext<LeaderboardGateway | null>(null);

// Last ranking per session: when the board is re-mounted in another screen (e.g. when the session closes)
// it shows this at once instead of flashing empty while the new fetch runs.
const lastSeen = new Map<number, LeaderboardResponse>();

// Loads the session's ranking and keeps it fresh: refetches on the `leaderboard` and `session` SSE events.
export function Leaderboard({ sessionId, highlightName, size, limit, title }: { sessionId: number; highlightName?: string; size?: 'md' | 'screen'; limit?: number; title?: string }) {
  const gateway = useContext(LeaderboardGatewayContext);
  if (!gateway) throw new Error('LeaderboardGatewayContext.Provider is missing above this component');
  const [data, setData] = useState<LeaderboardResponse | null>(() => lastSeen.get(sessionId) ?? null);
  const seq = useRef(0); // ignore a response that arrives after a newer request

  const refetch = useCallback(async () => {
    const n = ++seq.current;
    try {
      const r = await gateway.getLeaderboard(sessionId);
      if (n === seq.current) { lastSeen.set(sessionId, r); setData(r); }
    } catch { /* keep the last ranking; the next event refreshes it */ }
  }, [gateway, sessionId]);

  useEffect(() => { void refetch(); }, [refetch]);
  useSessionEvents(sessionId, { leaderboard: refetch, session: refetch });

  if (!data) return null;
  return <LeaderboardView entries={data.entries} provisional={data.provisional} hidden={data.hidden} submitted={data.submitted} highlightName={highlightName} size={size} limit={limit} title={title} />;
}
