import { createContext, useContext, useState, useSyncExternalStore } from 'react';
import type { GroupSummary } from '../../../../shared/api/index.js';
import type { GroupsGateway } from './groups-gateway.js';
import { GroupsController, type GroupsState } from './groups-controller.js';

export const GroupsGatewayContext = createContext<GroupsGateway | null>(null);

/** One controller for the page's lifetime, seeded with the list the route loader fetched. */
export function useGroups(initial: GroupSummary[]): { state: GroupsState; ctrl: GroupsController } {
  const gateway = useContext(GroupsGatewayContext);
  if (!gateway) throw new Error('GroupsGatewayContext.Provider is missing above this component');
  const [ctrl] = useState(() => new GroupsController(gateway, initial));
  return { state: useSyncExternalStore(ctrl.subscribe, ctrl.getState), ctrl };
}
