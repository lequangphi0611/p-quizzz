import { describe, expect, it } from 'vitest';
import { formatPoints, isAnswered } from './exam-progress.js';

describe('isAnswered', () => {
  it('a picked option or non-blank text counts', () => {
    expect(isAnswered({ selectedOptionIds: [1], textAnswer: null })).toBe(true);
    expect(isAnswered({ selectedOptionIds: null, textAnswer: 'x' })).toBe(true);
  });
  it('empty selection, blank text, or nothing saved does not', () => {
    expect(isAnswered({ selectedOptionIds: [], textAnswer: null })).toBe(false);
    expect(isAnswered({ selectedOptionIds: null, textAnswer: '  \n ' })).toBe(false);
    expect(isAnswered(undefined)).toBe(false);
  });
});

describe('formatPoints', () => {
  it('uses a decimal comma', () => expect(formatPoints(7.5)).toBe('7,5'));
});
