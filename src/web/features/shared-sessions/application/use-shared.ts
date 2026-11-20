import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { SharedSessionList, SharedSessionView } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { failureOf, type LoadFailure } from '../domain/shared-view.js';
import type { SharedSessionsGateway } from './shared-sessions-gateway.js';

export const SharedSessionsGatewayContext = createContext<SharedSessionsGateway | null>(null);

function useGateway(): SharedSessionsGateway {
  const g = useContext(SharedSessionsGatewayContext);
  if (!g) throw new Error('SharedSessionsGatewayContext.Provider is missing above this component');
  return g;
}

export type Load<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'failed'; failure: LoadFailure };

/** Loads once per key; `retry` loads again. What was shown stays until the new answer arrives (a dropped Wi-Fi keeps the page). */
function useLoad<T>(key: string, load: () => Promise<T>): { load: Load<T>; retry: () => void; retrying: boolean } {
  const [state, setState] = useState<Load<T>>({ state: 'loading' });
  const [n, setN] = useState(0);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    let live = true;
    load()
      .then(data => { if (live) setState({ state: 'ready', data }); })
      .catch(err => { if (live) setState(prev => (prev.state === 'ready' && failureOf(err instanceof ApiError ? err : null) === 'network' ? prev : { state: 'failed', failure: failureOf(err instanceof ApiError ? err : null) })); })
      .finally(() => { if (live) setRetrying(false); });
    return () => { live = false; };
  }, [key, n]);
  const retry = useCallback(() => { setRetrying(true); setN(x => x + 1); }, []);
  return { load: state, retry, retrying };
}

export function useSharedList(token: string) {
  const gateway = useGateway();
  return useLoad<SharedSessionList>(`list:${token}`, () => gateway.list(token));
}

export function useSharedSession(token: string, sessionId: number) {
  const gateway = useGateway();
  return useLoad<SharedSessionView>(`one:${token}:${sessionId}`, () => gateway.get(token, sessionId));
}
