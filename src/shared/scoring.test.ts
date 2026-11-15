import { describe, expect, it } from 'vitest';
import { pickCountedAttempt, scoreAnswer, totalScore, type ScorableQuestion } from './scoring.js';

const single: ScorableQuestion = { type: 'single', points: 2, options: [{ id: 1, isCorrect: false }, { id: 2, isCorrect: true }, { id: 3, isCorrect: false }] };
const multi: ScorableQuestion = { type: 'multi', points: 3, options: [{ id: 1, isCorrect: true }, { id: 2, isCorrect: true }, { id: 3, isCorrect: false }, { id: 4, isCorrect: false }] };
const essay: ScorableQuestion = { type: 'essay', points: 5, options: [] };

describe('scoreAnswer', () => {
  it('single: right → full points, wrong → 0, blank → 0', () => {
    expect(scoreAnswer(single, [2])).toBe(2);
    expect(scoreAnswer(single, [1])).toBe(0);
    expect(scoreAnswer(single, [])).toBe(0);
    expect(scoreAnswer(single, null)).toBe(0);
    expect(scoreAnswer(single, undefined)).toBe(0);
  });
  it('single: two picks including the right one is wrong', () => expect(scoreAnswer(single, [2, 3])).toBe(0));
  it('multi: exactly the correct set (any order) → full points', () => {
    expect(scoreAnswer(multi, [1, 2])).toBe(3);
    expect(scoreAnswer(multi, [2, 1])).toBe(3);
  });
  it('multi: missing one → 0; an extra one → 0; only wrong → 0; blank → 0', () => {
    expect(scoreAnswer(multi, [1])).toBe(0);
    expect(scoreAnswer(multi, [1, 2, 3])).toBe(0);
    expect(scoreAnswer(multi, [3, 4])).toBe(0);
    expect(scoreAnswer(multi, [])).toBe(0);
  });
  it('duplicate ids do not fake a match; ids outside the question score 0', () => {
    expect(scoreAnswer(multi, [1, 1])).toBe(0);
    expect(scoreAnswer(multi, [1, 2, 99])).toBe(0);
  });
  it('essay → null (manual grading), whatever was sent', () => {
    expect(scoreAnswer(essay, [])).toBeNull();
    expect(scoreAnswer(essay, [1])).toBeNull();
  });
  it('a malformed question with no correct option never awards points', () => {
    expect(scoreAnswer({ type: 'single', points: 1, options: [{ id: 1, isCorrect: false }] }, [])).toBe(0);
  });
});

describe('totalScore', () => {
  it('adds auto and manual, treating null as 0', () => {
    expect(totalScore({ autoScore: 3, manualScore: 4.5 })).toBe(7.5);
    expect(totalScore({ autoScore: 3, manualScore: null })).toBe(3);
    expect(totalScore({ autoScore: null, manualScore: null })).toBe(0);
  });
});

describe('pickCountedAttempt', () => {
  const a = (id: number, score: number, submittedAt: number | null) => ({ id, score, submittedAt });

  it('multiple-choice exam: highest score wins', () => {
    expect(pickCountedAttempt([a(1, 3, 100), a(2, 7, 200), a(3, 5, 300)], false)?.id).toBe(2);
  });
  it('tie on score → the earlier submission', () => {
    expect(pickCountedAttempt([a(1, 5, 300), a(2, 5, 100), a(3, 5, 200)], false)?.id).toBe(2);
  });
  it('a later, lower attempt never replaces a better earlier one', () => {
    expect(pickCountedAttempt([a(1, 9, 100), a(2, 0, 200)], false)?.id).toBe(1);
  });
  it('ignores attempts that are not submitted', () => {
    expect(pickCountedAttempt([a(1, 100, null), a(2, 4, 50)], false)?.id).toBe(2);
    expect(pickCountedAttempt([a(1, 100, null)], false)).toBeNull();
  });
  it('exam with essays: the single (earliest) submitted attempt, regardless of score', () => {
    expect(pickCountedAttempt([a(1, 1, 100), a(2, 9, 200)], true)?.id).toBe(1);
  });
  it('no attempts → null', () => {
    expect(pickCountedAttempt([], false)).toBeNull();
    expect(pickCountedAttempt([], true)).toBeNull();
  });
  it('does not mutate its input', () => {
    const input = [a(2, 1, 200), a(1, 1, 100)];
    pickCountedAttempt(input, false);
    expect(input.map(x => x.id)).toEqual([2, 1]);
  });
});
