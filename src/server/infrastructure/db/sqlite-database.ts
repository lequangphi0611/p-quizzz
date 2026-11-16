import { AsyncLocalStorage } from 'node:async_hooks';
import { sql } from 'drizzle-orm';
import { NestedUnitOfWorkError, type UnitOfWork } from '../../application/ports/unit-of-work.js';
import type { Db } from '../../db/client.js';

/** FIFO async mutex. */
class Mutex {
  private tail: Promise<void> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>(resolve => (release = resolve));
    const prev = this.tail;
    this.tail = prev.then(() => next);
    await prev;
    return release;
  }
}

interface Scope {
  active: boolean;
}

/**
 * Async access to the single better-sqlite3 connection (design "A" in docs/architecture.md §10).
 *
 * better-sqlite3 is synchronous, but an async unit of work can `await` between statements. With one
 * connection, any other request running in that gap would write into the open transaction, or read
 * rows that are not committed yet. So **every** access goes through one mutex: a unit of work holds it
 * from BEGIN to COMMIT/ROLLBACK, and plain reads wait for it.
 *
 * Code inside a unit of work reaches the connection through the callback's `db`, or through `read()`,
 * which detects the surrounding unit (AsyncLocalStorage) and runs directly instead of deadlocking on
 * the mutex it already holds.
 */
export class SqliteDatabase {
  private readonly lock = new Mutex();
  private readonly scope = new AsyncLocalStorage<Scope>();

  constructor(private readonly db: Db) {}

  private inUnit(): boolean {
    // `active` goes false once the unit ends, so a promise that outlives it cannot bypass the mutex.
    return this.scope.getStore()?.active === true;
  }

  /** Run a read (or any non-transactional access). Waits while a unit of work is open. */
  async read<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
    if (this.inUnit()) return fn(this.db); // same connection: sees the unit's own writes
    const release = await this.lock.acquire();
    try {
      return await fn(this.db);
    } finally {
      release();
    }
  }

  /** BEGIN IMMEDIATE ... COMMIT, ROLLBACK on throw. Units never overlap. */
  async transaction<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    if (this.inUnit()) throw new NestedUnitOfWorkError();
    const release = await this.lock.acquire();
    const scope: Scope = { active: true };
    try {
      this.db.run(sql`BEGIN IMMEDIATE`);
      try {
        const result = await this.scope.run(scope, () => fn(this.db));
        scope.active = false;
        this.db.run(sql`COMMIT`);
        return result;
      } catch (err) {
        scope.active = false;
        if (this.db.$client.inTransaction) this.db.run(sql`ROLLBACK`);
        throw err;
      }
    } finally {
      scope.active = false;
      release();
    }
  }
}

/** `makeCtx` builds the transactional repositories on the connection the unit is using. */
export class SqliteUnitOfWork<Ctx> implements UnitOfWork<Ctx> {
  constructor(
    private readonly database: SqliteDatabase,
    private readonly makeCtx: (db: Db) => Ctx,
  ) {}

  run<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T> {
    return this.database.transaction(db => fn(this.makeCtx(db)));
  }
}
