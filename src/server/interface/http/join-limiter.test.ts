import { describe, expect, it } from 'vitest';
import { createJoinLimiter } from './join-limiter.js';

describe('join limiter', () => {
  const make = () => {
    let t = 1_000_000;
    const limiter = createJoinLimiter({ max: 5, windowMs: 60_000, now: () => t });
    return { limiter, advance: (ms: number) => { t += ms; } };
  };

  it('allows up to 5 wrong codes, then blocks that address', () => {
    const { limiter } = make();
    for (let i = 0; i < 5; i++) { expect(limiter.retryAfter('a')).toBe(0); limiter.fail('a'); }
    expect(limiter.retryAfter('a')).toBeGreaterThan(0);
  });

  it('reports how long to wait and frees the address once the oldest failure leaves the window', () => {
    const { limiter, advance } = make();
    for (let i = 0; i < 5; i++) { limiter.fail('a'); advance(1000); }
    expect(limiter.retryAfter('a')).toBe(55); // the oldest failure is 5 s old; it leaves the window in 55 s
    advance(54_000);
    expect(limiter.retryAfter('a')).toBe(1);
    advance(1000);
    expect(limiter.retryAfter('a')).toBe(0);
  });

  it('tracks addresses independently', () => {
    const { limiter } = make();
    for (let i = 0; i < 5; i++) limiter.fail('a');
    expect(limiter.retryAfter('a')).toBeGreaterThan(0);
    expect(limiter.retryAfter('b')).toBe(0);
  });

  it('four failures are not enough to block', () => {
    const { limiter } = make();
    for (let i = 0; i < 4; i++) limiter.fail('a');
    expect(limiter.retryAfter('a')).toBe(0);
  });

  it('forgets old failures, so slow guessing is never blocked', () => {
    const { limiter, advance } = make();
    for (let i = 0; i < 20; i++) { limiter.fail('a'); advance(30_000); }
    expect(limiter.retryAfter('a')).toBe(0);
  });

  it('keeps memory bounded', () => {
    const limiter = createJoinLimiter({ maxKeys: 3 });
    for (let i = 0; i < 10; i++) limiter.fail(`ip${i}`);
    for (let i = 0; i < 5; i++) limiter.fail('ip9');
    expect(limiter.retryAfter('ip9')).toBeGreaterThan(0); // the newest keys survive
  });
});
