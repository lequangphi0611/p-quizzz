import { randomInt } from 'node:crypto';
import type { Random } from '../../application/ports/random.js';

export class CryptoRandom implements Random {
  int(maxExclusive: number): number {
    return randomInt(maxExclusive);
  }
}
