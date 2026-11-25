import { describe, expect, it } from 'vitest';
import { isStuck as isStuckAll, STUCK_REPEAT } from './is-stuck.js';

const fail = (toolTarget: string | null = 'npm test', claudeSessionId = 'A') => ({ ok: false, toolTarget, claudeSessionId });
const pass = (toolTarget: string | null = 'npm test', claudeSessionId = 'A') => ({ ok: true, toolTarget, claudeSessionId });
const isStuck = isStuckAll;

describe('isStuck', () => {
  it('needs 3 failures in a row on the same target', () => {
    expect(STUCK_REPEAT).toBe(3);
    expect(isStuck([fail(), fail(), fail()])).toBe(true);
    expect(isStuck([fail(), fail()])).toBe(false);
    expect(isStuck([])).toBe(false);
  });

  it('a success in between breaks the run, and one after it clears the flag', () => {
    expect(isStuck([fail(), pass(), fail(), fail()])).toBe(false);
    expect(isStuck([fail(), fail(), fail(), pass()])).toBe(false);
    expect(isStuck([pass(), fail(), fail(), fail()])).toBe(true);
  });

  it('only the run at the end counts, and a longer run is still stuck', () => {
    expect(isStuck([fail('a'), fail('a'), fail('a'), fail('b')])).toBe(false);
    expect(isStuck([fail('b'), fail('a'), fail('a'), fail('a'), fail('a')])).toBe(true);
  });

  it('different commands are not the same attempt', () => {
    expect(isStuck([fail('npm test'), fail('npm run build'), fail('npm test')])).toBe(false);
  });

  it('a call with no target is never counted as a repeat', () => {
    expect(isStuck([fail(null), fail(null), fail(null)])).toBe(false);
  });

  describe('several Claude Code sessions (PRODUCT.md §7.38c)', () => {
    it('stuck when one session failed 3 times, even with another session succeeding in between', () => {
      expect(isStuck([fail(), pass('npm test', 'B'), fail(), pass('ls', 'B'), fail()])).toBe(true);
    });
    it('not stuck with 2 failures in A and 1 in B on the same target', () => {
      expect(isStuck([fail(), fail('npm test', 'B'), fail()])).toBe(false);
    });
    it('a success in the same session still breaks the run', () => {
      expect(isStuck([fail(), fail(), pass(), fail('npm test', 'B'), fail()])).toBe(false);
    });
  });
});
