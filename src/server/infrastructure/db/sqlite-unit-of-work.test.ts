import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { NestedUnitOfWorkError } from '../../application/ports/unit-of-work.js';
import { createDb } from '../../db/client.js';
import { appMeta } from '../../db/schema.js';
import { SqliteDatabase, SqliteUnitOfWork } from './sqlite-database.js';

// `app_meta` is a convenient two-column table (key, value) for probing transactions.
const tick = (ms = 5) => new Promise<void>(r => setTimeout(r, ms)); // a real macrotask: other requests can run

function setup() {
  const db = createDb(':memory:');
  const database = new SqliteDatabase(db);
  const uow = new SqliteUnitOfWork(database, d => ({ db: d }));
  const put = (d: typeof db, key: string) => d.insert(appMeta).values({ key, value: key, updatedAt: new Date() }).run();
  const keys = (d: typeof db) => d.select().from(appMeta).all().map(r => r.key).sort();
  return { db, database, uow, put, keys };
}

describe('SqliteUnitOfWork (design A: one connection, one mutex)', () => {
  it('commits what the unit wrote', async () => {
    const { uow, database, put, keys } = setup();
    const out = await uow.run(async ({ db }) => {
      put(db, 'a');
      await tick();
      put(db, 'b');
      return 42;
    });
    expect(out).toBe(42);
    expect(await database.read(db => keys(db))).toEqual(['a', 'b']);
  });

  it('rolls back everything when the unit throws, and the next unit still works', async () => {
    const { uow, database, put, keys } = setup();
    await expect(
      uow.run(async ({ db }) => {
        put(db, 'a');
        await tick();
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await database.read(db => keys(db))).toEqual([]);
    await uow.run(async ({ db }) => put(db, 'c'));
    expect(await database.read(db => keys(db))).toEqual(['c']);
  });

  it('rolls back when COMMIT itself fails (deferred foreign key violation)', async () => {
    const { uow, database, db: raw, keys } = setup();
    raw.run(sql`CREATE TABLE parent (id INTEGER PRIMARY KEY)`);
    raw.run(sql`CREATE TABLE child (parent_id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)`);
    await expect(uow.run(async ({ db }) => void db.run(sql`INSERT INTO child VALUES (99)`))).rejects.toThrow(/COMMIT/);
    expect(raw.$client.inTransaction).toBe(false);
    expect(await database.read(db => db.all(sql`SELECT * FROM child`))).toEqual([]);
    expect(keys(raw)).toEqual([]);
  });

  it('two concurrent units never mix: one rolls back, the other still commits', async () => {
    const { uow, database, put, keys } = setup();
    const failing = uow.run(async ({ db }) => {
      put(db, 'x');
      await tick(20);
      throw new Error('fail');
    });
    const ok = uow.run(async ({ db }) => {
      put(db, 'y');
      await tick(1);
    });
    await expect(failing).rejects.toThrow('fail');
    await ok;
    // Mixed transactions would either lose 'y' (rolled back with x) or keep 'x'.
    expect(await database.read(db => keys(db))).toEqual(['y']);
  });

  it('a read outside the unit never sees uncommitted data', async () => {
    const { uow, database, put, keys } = setup();
    let inserted!: () => void;
    const insertedP = new Promise<void>(r => (inserted = r));
    const unit = uow.run(async ({ db }) => {
      put(db, 'ghost');
      inserted();
      await tick(30);
      throw new Error('rollback me');
    });
    await insertedP; // 'ghost' is written but uncommitted now
    const seen = await database.read(db => keys(db)); // must wait for the rollback
    await expect(unit).rejects.toThrow();
    expect(seen).toEqual([]);
  });

  it('a read outside the unit waits for COMMIT and then sees the data', async () => {
    const { uow, database, put, keys } = setup();
    let inserted!: () => void;
    const insertedP = new Promise<void>(r => (inserted = r));
    const unit = uow.run(async ({ db }) => {
      put(db, 'kept');
      inserted();
      await tick(30);
    });
    await insertedP;
    expect(await database.read(db => keys(db))).toEqual(['kept']);
    await unit;
  });

  it('read() inside a unit runs on the unit (sees its own writes, no deadlock)', async () => {
    const { uow, database, put, keys } = setup();
    const seen = await uow.run(async ({ db }) => {
      put(db, 'mine');
      return database.read(d => keys(d));
    });
    expect(seen).toEqual(['mine']);
  });

  it('rejects a nested unit of work clearly instead of deadlocking', async () => {
    const { uow } = setup();
    const result = await Promise.race([
      uow.run(async () => uow.run(async () => 1)).then(() => 'resolved', e => e),
      tick(500).then(() => 'deadlock'),
    ]);
    expect(result).toBeInstanceOf(NestedUnitOfWorkError);
  });

  it('a promise that outlives its unit cannot bypass the mutex', async () => {
    const { uow, database, put, keys } = setup();
    let leaked!: Promise<string[]>;
    await uow.run(async ({ db }) => {
      put(db, 'a');
      // fire-and-forget: resolves after the unit has committed
      leaked = tick(5).then(() => database.read(d => keys(d)));
    });
    const other = uow.run(async ({ db }) => {
      put(db, 'b');
      await tick(20);
      throw new Error('rollback b');
    });
    const seen = await leaked; // must not run in the middle of `other`
    await expect(other).rejects.toThrow();
    expect(seen).toEqual(['a']);
  });
});

describe('why a gate is needed (naive BEGIN + await on one connection)', () => {
  it('lets another request read uncommitted rows', async () => {
    const db = createDb(':memory:');
    db.run(sql`BEGIN IMMEDIATE`);
    db.insert(appMeta).values({ key: 'dirty', value: 'v', updatedAt: new Date() }).run();
    await tick(); // the event loop turns here
    const seenByOtherRequest = db.select().from(appMeta).all().map(r => r.key); // same connection
    db.run(sql`ROLLBACK`);
    expect(seenByOtherRequest).toEqual(['dirty']);
  });
});

describe('design B (two connections, WAL) for comparison', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('isolates readers natively, but needs a real file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pq-uow-'));
    dirs.push(dir);
    const file = join(dir, 't.db');
    const writer = createDb(file);
    const reader = new Database(file, { readonly: true });
    writer.run(sql`BEGIN IMMEDIATE`);
    writer.insert(appMeta).values({ key: 'k', value: 'v', updatedAt: new Date() }).run();
    expect(reader.prepare('SELECT count(*) AS n FROM app_meta').get()).toEqual({ n: 0 });
    writer.run(sql`COMMIT`);
    expect(reader.prepare('SELECT count(*) AS n FROM app_meta').get()).toEqual({ n: 1 });
    reader.close();
    writer.$client.close();
  });

  it('cannot share a ":memory:" database between connections (tests use ":memory:")', () => {
    const a = createDb(':memory:');
    const b = new Database(':memory:');
    a.insert(appMeta).values({ key: 'k', value: 'v', updatedAt: new Date() }).run();
    expect(() => b.prepare('SELECT * FROM app_meta').all()).toThrow(/no such table/);
    b.close();
  });
});
