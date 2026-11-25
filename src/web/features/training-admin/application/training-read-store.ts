import type { ReadState } from '../domain/unread.js';

/**
 * Port: what the mentor has read of each training, kept in this browser only (PRODUCT.md §7.38d). It never throws: without storage
 * (private window, blocked site data, damaged data) `load` answers an empty state, which the page treats as "first time here".
 */
export interface TrainingReadStore {
  load(trainingId: number): ReadState;
  save(trainingId: number, state: ReadState): void;
  /** The training ended: its record is of no use any more. */
  clear(trainingId: number): void;
  /** Drops the record of every training that is not in `liveTrainingIds` (gone, or ended). */
  clearExcept(liveTrainingIds: readonly number[]): void;
}

/** A store that remembers nothing across page loads: tests, and the fallback when no store is given. */
export class InMemoryTrainingReadStore implements TrainingReadStore {
  private data = new Map<number, ReadState>();
  load(trainingId: number): ReadState { return this.data.get(trainingId) ?? { members: {} }; }
  save(trainingId: number, state: ReadState): void { this.data.set(trainingId, state); }
  clear(trainingId: number): void { this.data.delete(trainingId); }
  clearExcept(liveTrainingIds: readonly number[]): void { for (const id of [...this.data.keys()]) if (!liveTrainingIds.includes(id)) this.data.delete(id); }
}
