import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useSessionEvents } from '../../../shared/events/use-session-events.js';
import type { ScreenGateway } from './screen-gateway.js';
import { ScreenController, type ScreenState } from './screen-controller.js';

export const ScreenGatewayContext = createContext<ScreenGateway | null>(null);

export function useScreenGateway(): ScreenGateway {
  const g = useContext(ScreenGatewayContext);
  if (!g) throw new Error('ScreenGatewayContext.Provider is missing above this component');
  return g;
}

/** One controller for the page's lifetime; polls while mounted and follows SSE for the session in view. */
export function useScreen(): { state: ScreenState; gateway: ScreenGateway } {
  const gateway = useScreenGateway();
  const [ctrl] = useState(() => new ScreenController(gateway));
  const state = useSyncExternalStore(ctrl.subscribe, ctrl.getState);
  useEffect(() => ctrl.start(), [ctrl]);
  useSessionEvents(state.latest?.id ?? null, { session: ctrl.onSessionEvent, participants: ctrl.onDataEvent, leaderboard: ctrl.onDataEvent });
  return { state, gateway };
}
