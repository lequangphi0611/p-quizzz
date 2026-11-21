import { createContext, useContext } from 'react';
import type { TrainingAdminGateway } from './training-admin-gateway.js';

export const TrainingAdminGatewayContext = createContext<TrainingAdminGateway | null>(null);

export function useTrainingAdminGateway(): TrainingAdminGateway {
  const g = useContext(TrainingAdminGatewayContext);
  if (!g) throw new Error('TrainingAdminGatewayContext.Provider is missing above this component');
  return g;
}
