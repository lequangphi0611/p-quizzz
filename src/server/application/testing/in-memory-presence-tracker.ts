import { connectionOf } from '../../domain/participant/presence.js';
import type { Clock } from '../ports/clock.js';
import type { PresenceTracker } from '../ports/presence-tracker.js';

/** Remembers when each participant was last heard from. Also the production implementation: presence is a few seconds of state. */
export class InMemoryPresenceTracker implements PresenceTracker {
  private seen = new Map<number, Date>();

  constructor(private readonly clock: Clock) {}

  touch(participantId: number): void {
    this.seen.set(participantId, this.clock.now());
  }

  connectionOf(participantId: number) {
    return connectionOf(this.seen.get(participantId) ?? null, this.clock.now());
  }
}
