import type { TrainingSignals } from '../../application/ports/training-signals.js';

/** Ingest can be very dense; the mentor's screen needs a refresh at most this often per training. */
export const TRAINING_SIGNAL_THROTTLE_MS = 2000;

interface Slot {
  lastAt: number;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Coalesces a burst of signals: the first goes out at once, anything that follows within the window becomes ONE more signal
 * when the window ends, so the screen never stays on stale data and never gets more than one signal per window.
 */
export class ThrottledTrainingSignals implements TrainingSignals {
  private readonly slots = new Map<number, Slot>();

  constructor(
    private readonly inner: TrainingSignals,
    private readonly intervalMs = TRAINING_SIGNAL_THROTTLE_MS,
    private readonly now: () => number = Date.now,
  ) {}

  async signal(trainingId: number): Promise<void> {
    const slot = this.slots.get(trainingId);
    const now = this.now();
    if (!slot || now - slot.lastAt >= this.intervalMs) {
      this.slots.set(trainingId, { lastAt: now, timer: null });
      await this.inner.signal(trainingId);
      return;
    }
    if (slot.timer) return;
    slot.timer = setTimeout(() => {
      slot.timer = null;
      slot.lastAt = this.now();
      void this.inner.signal(trainingId);
    }, slot.lastAt + this.intervalMs - now);
    slot.timer.unref?.();
  }
}
