import { describe, expect, it } from 'vitest';
import { chosenTimeLimit, parseMinutes, timeLimitHint } from './time-limit-ui.js';

describe('time limit form', () => {
  it('accepts whole minutes in range only', () => {
    expect(parseMinutes(' 30 ')).toEqual({ minutes: 30 });
    for (const bad of ['', '0', '301', '1.5', 'abc', '-3']) expect(parseMinutes(bad)).toHaveProperty('error');
  });

  it('null when off, the number when on, undefined when the box is invalid', () => {
    expect(chosenTimeLimit(false, 'abc')).toBeNull();
    expect(chosenTimeLimit(true, '45')).toBe(45);
    expect(chosenTimeLimit(true, '')).toBeUndefined();
  });

  it('says when the value comes from the exam file', () => {
    expect(timeLimitHint(45, true, '45')).toContain('theo file đề');
    expect(timeLimitHint(45, true, '30')).not.toContain('theo file đề');
    expect(timeLimitHint(45, false, '45')).toContain('đã tắt');
  });
});
