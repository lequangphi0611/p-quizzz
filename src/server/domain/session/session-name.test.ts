import { describe, expect, it } from 'vitest';
import { defaultSessionName, resolveSessionName } from './session-name.js';

describe('session name', () => {
  const now = new Date(2026, 10, 5, 9, 30); // 5 Nov 2026, local time

  it('defaults to "<exam title> – dd/MM" with zero-padded parts', () => {
    expect(defaultSessionName('Ôn tập Git', now)).toBe('Ôn tập Git – 05/11');
  });

  it('keeps what the mentor typed (trimmed) and falls back to the default when blank', () => {
    expect(resolveSessionName('  Lớp 0908  ', 'Đề', now)).toBe('Lớp 0908');
    expect(resolveSessionName('   ', 'Đề', now)).toBe('Đề – 05/11');
    expect(resolveSessionName(undefined, 'Đề', now)).toBe('Đề – 05/11');
  });
});
