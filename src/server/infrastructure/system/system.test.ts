import { describe, expect, it } from 'vitest';
import { CryptoRandom } from './crypto-random.js';
import { SecureTokenGenerator } from './secure-token-generator.js';
import { SystemClock } from './system-clock.js';

describe('system adapters', () => {
  it('SystemClock returns the current time', () => {
    const before = Date.now();
    const t = new SystemClock().now().getTime();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(Date.now());
  });

  it('SecureTokenGenerator makes 43-char base64url tokens that do not repeat', () => {
    const gen = new SecureTokenGenerator();
    const tokens = new Set(Array.from({ length: 100 }, () => gen.generate()));
    expect(tokens.size).toBe(100);
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('CryptoRandom stays inside [0, max)', () => {
    const r = new CryptoRandom();
    for (let i = 0; i < 500; i++) {
      const n = r.int(5);
      expect(Number.isInteger(n) && n >= 0 && n < 5).toBe(true);
    }
  });
});
