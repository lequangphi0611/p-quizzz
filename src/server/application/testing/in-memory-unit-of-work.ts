import type { UnitOfWork } from '../ports/unit-of-work.js';

/** An in-memory store that can be rolled back. */
export interface Snapshottable {
  snapshot(): unknown;
  restore(snapshot: unknown): void;
}

/** Test double for `UnitOfWork`: if the callback throws, every store is restored to its state before `run`. */
export class InMemoryUnitOfWork<Ctx> implements UnitOfWork<Ctx> {
  constructor(
    private readonly ctx: Ctx,
    private readonly stores: Snapshottable[],
  ) {}

  async run<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T> {
    const before = this.stores.map(s => s.snapshot());
    try {
      return await fn(this.ctx);
    } catch (err) {
      this.stores.forEach((s, i) => s.restore(before[i]));
      throw err;
    }
  }
}
