// Micro-benchmark for the UnitOfWork spike (docs/architecture.md §10): cost of routing a read through the mutex.
// Run: npx tsx scripts/bench-uow.ts
import { eq } from 'drizzle-orm';
import { createDb } from '../src/server/infrastructure/db/client.js';
import { appMeta } from '../src/server/infrastructure/db/schema.js';
import { SqliteDatabase } from '../src/server/infrastructure/db/sqlite-database.js';

const db = createDb(':memory:');
db.insert(appMeta).values({ key: 'k', value: 'v', updatedAt: new Date() }).run();
const q = () => db.select().from(appMeta).where(eq(appMeta.key, 'k')).get();
const database = new SqliteDatabase(db);
const N = 100_000;

async function time(label: string, fn: () => Promise<void> | void) {
  for (let i = 0; i < 5000; i++) await fn(); // warmup
  const t = performance.now();
  for (let i = 0; i < N; i++) await fn();
  const ms = performance.now() - t;
  console.log(`${label.padEnd(34)} ${(ms / N * 1000).toFixed(2)} us/op  (${Math.round(N / ms * 1000)} op/s)`);
}
await time('direct sync read (today)', () => { q(); });
await time('database.read() via mutex', async () => { await database.read(() => q()); });
// 50 "members" polling at once through the mutex
const t = performance.now();
for (let r = 0; r < 2000; r++) await Promise.all(Array.from({ length: 50 }, () => database.read(() => q())));
console.log(`50 concurrent reads x2000 rounds    ${((performance.now() - t) / (2000 * 50) * 1000).toFixed(2)} us/read`);
