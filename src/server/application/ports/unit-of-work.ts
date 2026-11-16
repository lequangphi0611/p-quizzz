/**
 * Runs `fn` as one atomic unit: everything it does commits together, or rolls back if it throws.
 *
 * `Ctx` is whatever the use cases need inside the unit (typically the transactional repositories);
 * the application layer defines it, the infrastructure layer builds it. Rules for `fn`:
 * - do not await anything slow (timers, network): the unit holds the database for its whole duration;
 * - do not start another unit of work inside it (rejected with `NestedUnitOfWorkError`).
 */
export interface UnitOfWork<Ctx> {
  run<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T>;
}

export class NestedUnitOfWorkError extends Error {
  constructor() {
    super('UnitOfWork.run() was called inside another unit of work; pass the ctx you already have instead');
    this.name = 'NestedUnitOfWorkError';
  }
}
