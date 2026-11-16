import { describe, expect, it } from 'vitest';
import { DisplayNameBody, displayNameKey, normalizeDisplayName } from './participants.js';

describe('normalizeDisplayName', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeDisplayName('  An   Nguyễn ')).toBe('An Nguyễn');
  });

  it('removes zero-width, control and bidi-override characters so look-alike names collide', () => {
    expect(normalizeDisplayName('A\u200Bn')).toBe('An');
    expect(normalizeDisplayName('A\u202En')).toBe('An');
    expect(normalizeDisplayName('A\u0007n\uFEFF')).toBe('An');
    expect(displayNameKey('A\u200Bn')).toBe(displayNameKey('an'));
  });

  it('keeps emoji joiner sequences', () => {
    expect(normalizeDisplayName('👨\u200D👩')).toBe('👨\u200D👩');
  });

  it('a name made only of invisible characters is rejected as empty', () => {
    expect(DisplayNameBody.safeParse({ displayName: '\u200B\u200E\u2060' }).success).toBe(false);
  });
});
