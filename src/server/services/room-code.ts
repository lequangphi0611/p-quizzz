import { randomInt } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { ROOM_CODE_LENGTH } from '../../shared/api/index.js';
import { sessions } from '../db/schema.js';
import type { DbOrTx } from './sessions.js';

const SPACE = 10 ** ROOM_CODE_LENGTH;

/** A random zero-padded code such as "048213" (crypto-grade randomness: codes must not be guessable). */
export const randomRoomCode = (rand: (max: number) => number = randomInt): string => String(rand(SPACE)).padStart(ROOM_CODE_LENGTH, '0');

/** A code no session has used. Retries on the (rare) collision so every session keeps a unique code. */
export function newRoomCode(db: DbOrTx, rand?: (max: number) => number): string {
  for (let i = 0; i < 50; i++) {
    const code = randomRoomCode(rand);
    if (!db.select({ id: sessions.id }).from(sessions).where(eq(sessions.roomCode, code)).get()) return code;
  }
  throw new Error('Không tạo được mã phòng duy nhất'); // astronomically unlikely
}
