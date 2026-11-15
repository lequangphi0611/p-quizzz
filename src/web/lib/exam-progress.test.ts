import { describe, expect, it } from 'vitest';
import { formatPoints, headlineAttempt, isAnswered } from './exam-progress.js';

const att = (id: number, score: number) => ({ id, attemptNo: id, submittedAt: id, score, maxScore: 10 });

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

describe('headlineAttempt', () => {
  it('picks the best score; on a tie the later attempt', () => {
    expect(headlineAttempt([att(1, 4), att(2, 8), att(3, 6)])?.id).toBe(2);
    expect(headlineAttempt([att(1, 8), att(2, 8)])?.id).toBe(2);
  });
  it('null with no attempts', () => expect(headlineAttempt([])).toBeNull());
});

describe('formatPoints', () => {
  it('uses a decimal comma', () => expect(formatPoints(7.5)).toBe('7,5'));
});
