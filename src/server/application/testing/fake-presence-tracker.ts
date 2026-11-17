import { connectionOf } from '../../domain/participant/presence.js';
import type { Clock } from '../ports/clock.js';
import type { PresenceTracker } from '../ports/presence-tracker.js';

/** Test double: remembers when each participant was last touched. The real one is infrastructure/system. */
export class FakePresenceTracker implements PresenceTracker {
  private seen = new Map<number, Date>();

  constructor(private readonly clock: Clock) {}

  touch(participantId: number): void {
    this.seen.set(participantId, this.clock.now());
  }

  connectionOf(participantId: number) {
    return connectionOf(this.seen.get(participantId) ?? null, this.clock.now());
  }
}
