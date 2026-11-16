import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { randomRoomCode } from './room-code.js';

describe('randomRoomCode', () => {
  it('is always 6 digits, zero-padded', () => {
    expect(randomRoomCode(() => 7)).toBe('000007');
    expect(randomRoomCode(() => 999_999)).toBe('999999');
    for (let i = 0; i < 200; i++) expect(randomRoomCode(randomInt)).toMatch(/^\d{6}$/);
  });

  it('is not sequential or constant', () => {
    const seen = new Set(Array.from({ length: 200 }, () => randomRoomCode(randomInt)));
    expect(seen.size).toBeGreaterThan(190);
  });
});
