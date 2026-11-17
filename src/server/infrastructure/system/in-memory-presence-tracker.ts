import { connectionOf, ONLINE_WITHIN_MS } from '../../domain/participant/presence.js';
import type { Clock } from '../../application/ports/clock.js';
import type { PresenceTracker } from '../../application/ports/presence-tracker.js';

/** Entries older than this are dropped on the next sweep (an hour: long enough for the mentor to see "last seen"). */
const KEEP_MS = 60 * 60_000;
const SWEEP_EVERY_MS = 5 * 60_000;

/**
 * Remembers when each participant was last heard from, in memory only: presence is a few seconds of state, and a restart
 * means everyone reads as offline until their next poll (PRODUCT.md §7.23b). Old entries are swept so the map stays small.
 */
export class InMemoryPresenceTracker implements PresenceTracker {
  private seen = new Map<number, Date>();
  private lastSweep: number;

  constructor(private readonly clock: Clock) {
    this.lastSweep = clock.now().getTime();
  }

  touch(participantId: number): void {
    const now = this.clock.now();
    this.seen.set(participantId, now);
    this.sweep(now.getTime());
  }

  connectionOf(participantId: number) {
    return connectionOf(this.seen.get(participantId) ?? null, this.clock.now());
  }

  private sweep(nowMs: number): void {
    if (nowMs - this.lastSweep < SWEEP_EVERY_MS) return;
    this.lastSweep = nowMs;
    for (const [id, at] of this.seen) if (nowMs - at.getTime() > Math.max(KEEP_MS, ONLINE_WITHIN_MS)) this.seen.delete(id);
  }
}
