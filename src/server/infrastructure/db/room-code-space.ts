import { eq } from 'drizzle-orm';
import type { Db } from './client.js';
import { sessions, trainings } from './schema.js';

/**
 * Sessions and trainings share one room-code space: a member types a code at `/` and it must lead to exactly one place.
 * A stopped training has no code (null), so its code is free again; a session keeps its code forever.
 */
export function roomCodeTaken(db: Db, code: string): boolean {
  return !!db.select({ id: sessions.id }).from(sessions).where(eq(sessions.roomCode, code)).get()
    || !!db.select({ id: trainings.id }).from(trainings).where(eq(trainings.roomCode, code)).get();
}
