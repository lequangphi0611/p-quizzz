import { randomRoomCode } from '../../../domain/session/room-code.js';
import type { Random } from '../../ports/random.js';

/** A code no session has used. Retries on the (rare) collision so every session keeps a unique code. */
export async function newRoomCode(random: Random, inUse: (code: string) => Promise<boolean>): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const code = randomRoomCode(n => random.int(n));
    if (!(await inUse(code))) return code;
  }
  throw new Error('Không tạo được mã phòng duy nhất'); // astronomically unlikely
}
