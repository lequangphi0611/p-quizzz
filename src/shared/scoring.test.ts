import { describe, expect, it } from 'vitest';
import { pickCountedAttempt, rankLeaderboard, scoreAnswer, totalScore, type ScorableQuestion } from './scoring.js';

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

describe('rankLeaderboard', () => {
  const e = (displayName: string, score: number, submittedAt: number) => ({ displayName, score, submittedAt });
  const names = (rows: { displayName: string }[]) => rows.map(r => r.displayName);

  it('orders by score, highest first', () => {
    expect(names(rankLeaderboard([e('b', 5, 1), e('a', 9, 2), e('c', 7, 3)]))).toEqual(['a', 'c', 'b']);
  });
  it('equal score: whoever submitted earlier ranks higher', () => {
    const out = rankLeaderboard([e('late', 5, 300), e('early', 5, 100), e('mid', 5, 200)]);
    expect(names(out)).toEqual(['early', 'mid', 'late']);
    expect(out.map(r => r.rank)).toEqual([1, 2, 3]);
  });
  it('same score and same instant share a rank; the next rank skips (1, 1, 3)', () => {
    const out = rankLeaderboard([e('x', 9, 100), e('y', 9, 100), e('z', 5, 50)]);
    expect(out.map(r => r.rank)).toEqual([1, 1, 3]);
  });
  it('a three-way tie, then the rest: 1, 1, 1, 4', () => {
    expect(rankLeaderboard([e('a', 9, 1), e('b', 9, 1), e('c', 9, 1), e('d', 2, 1)]).map(r => r.rank)).toEqual([1, 1, 1, 4]);
  });
  it('handles half points', () => {
    expect(names(rankLeaderboard([e('a', 7, 1), e('b', 7.5, 2)]))).toEqual(['b', 'a']);
  });
  it('is deterministic for full ties (by name) and keeps extra fields', () => {
    const out = rankLeaderboard([{ ...e('Bình', 3, 1), id: 2 }, { ...e('An', 3, 1), id: 1 }]);
    expect(out.map(r => [r.displayName, r.id, r.rank])).toEqual([['An', 1, 1], ['Bình', 2, 1]]);
  });
  it('empty in, empty out; does not mutate the input', () => {
    expect(rankLeaderboard([])).toEqual([]);
    const input = [e('b', 1, 1), e('a', 2, 1)];
    rankLeaderboard(input);
    expect(names(input)).toEqual(['b', 'a']);
  });
});
