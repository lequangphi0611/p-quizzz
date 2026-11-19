import { describe, expect, it } from 'vitest';
import { isAnswered, isMissingReason } from './answered.js';

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

describe('isMissingReason', () => {
  const rq = { requireReason: true };
  it('flags a pick without a reason only on {reason} questions', () => {
    expect(isMissingReason(rq, { selectedOptionIds: [1], reasonText: null })).toBe(true);
    expect(isMissingReason(rq, { selectedOptionIds: [1], reasonText: '   ' })).toBe(true);
    expect(isMissingReason(rq, { selectedOptionIds: [1], reasonText: 'vì vậy' })).toBe(false);
    expect(isMissingReason({ requireReason: false }, { selectedOptionIds: [1], reasonText: null })).toBe(false);
  });
  it('allows leaving the whole question blank', () => {
    expect(isMissingReason(rq, undefined)).toBe(false);
    expect(isMissingReason(rq, { selectedOptionIds: [], reasonText: null })).toBe(false);
  });
});
