import { createContext, useContext } from 'react';
import type { TrainingAdminGateway } from './training-admin-gateway.js';
import { InMemoryTrainingReadStore, type TrainingReadStore } from './training-read-store.js';

export const TrainingAdminGatewayContext = createContext<TrainingAdminGateway | null>(null);

export function useTrainingAdminGateway(): TrainingAdminGateway {
  const g = useContext(TrainingAdminGatewayContext);
  if (!g) throw new Error('TrainingAdminGatewayContext.Provider is missing above this component');
  return g;
}

/** Where the mentor's "đã đọc" is kept (S43). The composition root provides the localStorage one; without a provider nothing is remembered. */
export const TrainingReadStoreContext = createContext<TrainingReadStore>(new InMemoryTrainingReadStore());

export const useTrainingReadStore = (): TrainingReadStore => useContext(TrainingReadStoreContext);
