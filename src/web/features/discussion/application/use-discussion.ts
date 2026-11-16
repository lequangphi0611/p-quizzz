import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { DiscussionGateway } from './discussion-gateway.js';
import { DiscussionController, initialDiscussionState, type DiscussionState } from './discussion-controller.js';

export const DiscussionGatewayContext = createContext<DiscussionGateway | null>(null);

export function useDiscussionGateway(): DiscussionGateway {
  const g = useContext(DiscussionGatewayContext);
  if (!g) throw new Error('DiscussionGatewayContext.Provider is missing above this component');
  return g;
}

const noopSubscribe = () => () => {};
const EMPTY = initialDiscussionState();

/** One controller per session id, created in an effect (StrictMode runs effects twice). Loads on creation. */
export function useDiscussion(sessionId: number): { state: DiscussionState; ctrl: DiscussionController | null } {
  const gateway = useDiscussionGateway();
  const [ctrl, setCtrl] = useState<DiscussionController | null>(null);
  useEffect(() => {
    const c = new DiscussionController(gateway, sessionId);
    setCtrl(c);
    void c.load();
  }, [gateway, sessionId]);
  const state = useSyncExternalStore(ctrl ? ctrl.subscribe : noopSubscribe, ctrl ? ctrl.getState : () => EMPTY);
  return { state, ctrl };
}
