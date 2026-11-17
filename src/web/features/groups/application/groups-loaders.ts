import type { GroupSummary } from '../../../../shared/api/index.js';
import type { GroupsGateway } from './groups-gateway.js';

/** react-router loaders of the group routes, bound to a gateway by the composition root. */
export const createGroupLoaders = (gateway: GroupsGateway) => ({
  list: (): Promise<GroupSummary[]> => gateway.list(),
});
