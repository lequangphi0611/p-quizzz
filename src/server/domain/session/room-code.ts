import { ROOM_CODE_LENGTH } from '../../../shared/api/index.js';
import type { RandomInt } from '../shuffle.js';

const SPACE = 10 ** ROOM_CODE_LENGTH;

/** A random zero-padded code such as "048213". Pass a cryptographic `randomInt`: codes must not be guessable. */
export const randomRoomCode = (randomInt: RandomInt): string => String(randomInt(SPACE)).padStart(ROOM_CODE_LENGTH, '0');
