import { describe, expect, it } from 'vitest';
import { isStuck, STUCK_REPEAT } from './is-stuck.js';

const fail = (toolTarget: string | null = 'npm test') => ({ ok: false, toolTarget });
const pass = (toolTarget: string | null = 'npm test') => ({ ok: true, toolTarget });

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
});
