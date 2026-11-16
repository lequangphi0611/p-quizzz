import { randomInt } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { randomRoomCode } from '../domain/session/room-code.js';
import type { RandomInt } from '../domain/shuffle.js';
import { sessions } from '../db/schema.js';
import type { DbOrTx } from './sessions.js';

/** A code no session has used. Retries on the (rare) collision so every session keeps a unique code. */
export function newRoomCode(db: DbOrTx, rand: RandomInt = randomInt): string {
  for (let i = 0; i < 50; i++) {
    const code = randomRoomCode(rand);
    if (!db.select({ id: sessions.id }).from(sessions).where(eq(sessions.roomCode, code)).get()) return code;
  }
  throw new Error('Không tạo được mã phòng duy nhất'); // astronomically unlikely
}
