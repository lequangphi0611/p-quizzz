import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useSessionEvents } from '../../../shared/events/use-session-events.js';
import { TokenStoreContext } from '../../../shared/token-store/token-store-context.js';
import type { MemberGateway, RoomCodeMemory } from './member-gateway.js';
import { MemberHomeController, selectActiveId, type MemberHomeState } from './member-home-controller.js';

export const MemberServicesContext = createContext<{ gateway: MemberGateway; rooms: RoomCodeMemory } | null>(null);

/** One controller for the home page's lifetime; polls while mounted and follows SSE for the session in view. */
export function useMemberHome(): { state: MemberHomeState; ctrl: MemberHomeController; activeId: number | null } {
  const services = useContext(MemberServicesContext);
  const tokens = useContext(TokenStoreContext);
  if (!services || !tokens) throw new Error('MemberServicesContext / TokenStoreContext providers are missing above this component');
  const [ctrl] = useState(() => new MemberHomeController(services.gateway, tokens, services.rooms));
  const state = useSyncExternalStore(ctrl.subscribe, ctrl.getState);
  useEffect(() => ctrl.start(), [ctrl]);
  const activeId = selectActiveId(state);
  useSessionEvents(activeId, { session: ctrl.onSessionEvent, participants: ctrl.onParticipantsEvent });
  return { state, ctrl, activeId };
}
