import { createContext, useContext, useState, useSyncExternalStore } from 'react';
import type { GradingView } from '../../../../shared/api/index.js';
import type { GradingGateway } from './grading-gateway.js';
import { GradingController, type GradingState } from './grading-controller.js';

export const GradingGatewayContext = createContext<GradingGateway | null>(null);

/** One controller per loaded grading view (the page re-mounts per session). */
export function useGrading(sessionId: number, initial: GradingView): { state: GradingState; ctrl: GradingController } {
  const gateway = useContext(GradingGatewayContext);
  if (!gateway) throw new Error('GradingGatewayContext.Provider is missing above this component');
  const [ctrl] = useState(() => new GradingController(gateway, sessionId, initial));
  const state = useSyncExternalStore(ctrl.subscribe, ctrl.getState);
  return { state, ctrl };
}
