/**
 * The "2 seconds in view" rule of PRODUCT.md §7.38d, apart from the DOM. The page reports, after every scroll, resize, focus change
 * and render, which cards are in view (each with the biggest event id it holds right now) and whether anything may be counted
 * (tab visible, window focused, content not hidden). A card that stays in view for `delayMs` is read up to the id it held **when it
 * started**: an event that arrives meanwhile stays new. Leaving the view, or `canCount` turning false, resets the card to zero.
 */
export const READ_DWELL_MS = 2000;

export interface DwellTimers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const realTimers: DwellTimers = { set: (fn, ms) => setTimeout(fn, ms), clear: h => clearTimeout(h as ReturnType<typeof setTimeout>) };

export class ReadDwell {
  private running = new Map<string, { startId: number; handle: unknown }>();

  constructor(private onRead: (key: string, maxId: number) => void, private delayMs = READ_DWELL_MS, private timers: DwellTimers = realTimers) {}

  /** `inView`: key → the biggest event id the card holds now. Keys that are not in the map stop counting. */
  update(inView: ReadonlyMap<string, number>, canCount: boolean): void {
    for (const [key, run] of this.running) {
      if (canCount && inView.has(key)) continue;
      this.timers.clear(run.handle);
      this.running.delete(key);
    }
    if (!canCount) return;
    for (const [key, maxId] of inView) {
      if (this.running.has(key)) continue;
      const run = { startId: maxId, handle: undefined as unknown };
      run.handle = this.timers.set(() => {
        this.running.delete(key);
        this.onRead(key, run.startId);
      }, this.delayMs);
      this.running.set(key, run);
    }
  }

  /** Keys that are counting right now (for tests). */
  get counting(): string[] { return [...this.running.keys()]; }

  dispose(): void { this.update(new Map(), false); }
}
