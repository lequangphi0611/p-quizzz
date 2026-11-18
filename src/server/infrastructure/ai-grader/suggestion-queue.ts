import type { SuggestionQueue } from '../../application/ports/ai-suggestion-repository.js';

/**
 * Runs AI suggestions in the background, in the order they were queued, `concurrency` at a time (read before each
 * start so the mentor's config applies). In memory: a restart loses the queue, and the rows are failed at startup.
 */
export class InProcessSuggestionQueue implements SuggestionQueue {
  private pending: number[] = [];
  private active = 0;
  private waiters: (() => void)[] = [];

  constructor(
    private readonly run: (id: number) => Promise<void>,
    private readonly concurrency: () => Promise<number> = async () => 1,
  ) {}

  enqueue(ids: number[]): void {
    this.pending.push(...ids);
    void this.pump();
  }

  /** Resolves when nothing is queued or running (tests). */
  idle(): Promise<void> {
    if (this.active === 0 && this.pending.length === 0) return Promise.resolve();
    return new Promise(r => this.waiters.push(r));
  }

  private async pump(): Promise<void> {
    const limit = Math.max(1, await this.concurrency().catch(() => 1));
    while (this.active < limit && this.pending.length > 0) {
      const id = this.pending.shift()!;
      this.active++;
      this.run(id)
        .catch(() => {})
        .finally(() => {
          this.active--;
          if (this.active === 0 && this.pending.length === 0) this.waiters.splice(0).forEach(w => w());
          else void this.pump();
        });
    }
  }
}
