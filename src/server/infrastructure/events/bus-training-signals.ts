import type { TrainingSignals } from '../../application/ports/training-signals.js';
import type { EventBus } from './event-bus.js';

/** `TrainingSignals` backed by the in-process bus the mentor's SSE stream listens to. */
export class BusTrainingSignals implements TrainingSignals {
  constructor(private readonly bus: Pick<EventBus, 'publishTraining'>) {}

  async signal(trainingId: number): Promise<void> {
    this.bus.publishTraining(trainingId);
  }
}
