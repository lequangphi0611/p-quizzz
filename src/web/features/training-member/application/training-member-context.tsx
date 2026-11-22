import { createContext, useContext } from 'react';
import type { TrainingMemberGateway, TrainingTokenStore } from './training-member-gateway.js';

export interface TrainingMemberServices {
  gateway: TrainingMemberGateway;
  tokens: TrainingTokenStore;
}

export const TrainingMemberServicesContext = createContext<TrainingMemberServices | null>(null);

export function useTrainingMemberServices(): TrainingMemberServices {
  const s = useContext(TrainingMemberServicesContext);
  if (!s) throw new Error('TrainingMemberServicesContext.Provider is missing above this component');
  return s;
}
