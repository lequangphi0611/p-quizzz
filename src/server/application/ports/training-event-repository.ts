import type { TrainingEventDraft } from '../../domain/training/training-event.js';

/** A filtered hook call, stamped with whose it is and when it arrived. */
export type NewTrainingEvent = TrainingEventDraft & { memberId: number; receivedAt: Date };

/** Write side: only reachable inside a unit of work (see `TrainingUnitContext`). */
export interface TrainingEventRepository {
  append(event: NewTrainingEvent): Promise<void>;
}
