import type { TrainingSignals } from '../ports/training-signals.js';
import type { SessionEventType } from '../../../shared/api/index.js';
import type { Clock } from '../ports/clock.js';
import type { EventPublisher } from '../ports/event-publisher.js';
import type { Random } from '../ports/random.js';
import type { TokenGenerator } from '../ports/token-generator.js';

/** A clock that only moves when the test says so. */
export class FakeClock implements Clock {
  private current: number;

  constructor(start: Date | number = 0) {
    this.current = typeof start === 'number' ? start : start.getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number) {
    this.current += ms;
  }

  set(time: Date | number) {
    this.current = typeof time === 'number' ? time : time.getTime();
  }
}

/** Tokens "token-1", "token-2", ... so tests can predict them. */
export class FakeTokenGenerator implements TokenGenerator {
  private n = 0;

  generate(): string {
    return `token-${++this.n}`;
  }
}

/** Plays back the given integers in order (cycling); each is clamped into [0, max) like a real draw. */
export class FakeRandom implements Random {
  private i = 0;

  constructor(private readonly values: number[] = [0]) {}

  int(maxExclusive: number): number {
    const v = this.values[this.i++ % this.values.length]!;
    return ((v % maxExclusive) + maxExclusive) % maxExclusive;
  }
}

/** Remembers every event instead of sending it. */
export class RecordingEventPublisher implements EventPublisher {
  readonly events: { sessionId: number; type: SessionEventType }[] = [];

  async publish(sessionId: number, type: SessionEventType): Promise<void> {
    this.events.push({ sessionId, type });
  }
}

/** Remembers every training signal instead of sending it. */
export class RecordingTrainingSignals implements TrainingSignals {
  readonly signals: number[] = [];

  async signal(trainingId: number): Promise<void> {
    this.signals.push(trainingId);
  }
}
