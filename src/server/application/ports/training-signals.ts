/**
 * Tells the mentor's screen that something changed in a training (member in/out, state change). Carries no data:
 * the page refetches. Publish after the unit of work has committed.
 */
export interface TrainingSignals {
  signal(trainingId: number): Promise<void>;
}
