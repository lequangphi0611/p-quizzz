import type { TrainingTokenStore } from '../application/training-member-gateway.js';

const key = (trainingId: number) => `pq:training:${trainingId}`;

/** `localStorage` can throw or be missing (private mode, blocked storage): that reads as "no token" and writes are dropped. */
export class LocalStorageTrainingTokenStore implements TrainingTokenStore {
  get(trainingId: number): string | null {
    try { return localStorage.getItem(key(trainingId)); } catch { return null; }
  }
  set(trainingId: number, token: string): void {
    try { localStorage.setItem(key(trainingId), token); } catch { /* ignore */ }
  }
  clear(trainingId: number): void {
    try { localStorage.removeItem(key(trainingId)); } catch { /* ignore */ }
  }
}
