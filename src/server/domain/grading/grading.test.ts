import { describe, expect, it } from 'vitest';
import type { Attempt } from '../attempt/attempt.js';
import { ParticipantKickedError } from '../participant/errors.js';
import { buildLeaderboard } from '../leaderboard/leaderboard.js';
import {
  DiscussionNotOpenError, GradingNotOpenError, NotEssayError, NotSubmittedYetError, ResultsFinalizedError, ScoreOutOfRangeError,
} from './errors.js';
import {
  assertDiscussionOpen, assertGradable, assertGradingOpen, canFinalize, essayProgress, manualTotal, normalizeFeedback, pickCountedAttempts, shuffleKey,
} from './grading.js';

const att = (o: Partial<Attempt>): Attempt => ({ id: 1, participantId: 1, attemptNo: 1, questionOrder: [], optionOrder: {}, startedAt: new Date(0), submittedAt: null, autoScore: null, manualScore: null, ...o });

describe('shuffle key', () => {
  it('is stable, per question, and unrelated to the answer order', () => {
    expect(shuffleKey(1, 2, 3)).toBe(shuffleKey(1, 2, 3));
    expect(shuffleKey(1, 2, 3)).not.toBe(shuffleKey(1, 3, 3));
    const order = [1, 2, 3, 4, 5, 6].sort((a, b) => (shuffleKey(1, 9, a) < shuffleKey(1, 9, b) ? -1 : 1));
    expect(order).not.toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('counted attempts and finalizing', () => {
  it('counts each participant\'s submitted attempt only (the earliest if several)', () => {
    const counted = pickCountedAttempts([
      att({ id: 1, participantId: 1 }), // open: never counts
      att({ id: 2, participantId: 2, submittedAt: new Date(20) }),
      att({ id: 3, participantId: 2, attemptNo: 2, submittedAt: new Date(10) }),
    ]);
    expect([...counted.keys()]).toEqual([2]);
    expect(counted.get(2)!.id).toBe(3);
  });

  it('canFinalize needs every essay answer scored, blank ones included', () => {
    expect(essayProgress([{ manualScore: 1 }, { manualScore: null }])).toEqual({ graded: 1, total: 2 });
    expect(canFinalize({ graded: 1, total: 2 })).toBe(false);
    expect(canFinalize({ graded: 2, total: 2 })).toBe(true);
    expect(canFinalize({ graded: 0, total: 0 })).toBe(true);
    expect(canFinalize(essayProgress([{ manualScore: 0 }]))).toBe(true); // a zero is a score
  });

  it('screens open after the close', () => {
    expect(() => assertGradingOpen('running')).toThrow(GradingNotOpenError);
    expect(() => assertGradingOpen('closed')).not.toThrow();
    expect(() => assertDiscussionOpen('lobby')).toThrow(DiscussionNotOpenError);
    expect(() => assertDiscussionOpen('finalized')).not.toThrow();
  });
});

describe('assertGradable', () => {
  const ok = { questionType: 'essay' as const, questionPoints: 4, sessionStatus: 'closed' as const, participantStatus: 'active' as const, attemptSubmitted: true, score: 2.5 };
  it('accepts a closed session, an active member and a score within the points', () => {
    expect(() => assertGradable(ok)).not.toThrow();
    expect(() => assertGradable({ ...ok, score: 4 })).not.toThrow();
  });

  it('refuses, in order: not essay, finalized, not closed, kicked, not submitted, too high', () => {
    expect(() => assertGradable({ ...ok, questionType: 'single' })).toThrow(NotEssayError);
    expect(() => assertGradable({ ...ok, sessionStatus: 'finalized' })).toThrow(ResultsFinalizedError);
    expect(() => assertGradable({ ...ok, sessionStatus: 'running' })).toThrow(GradingNotOpenError);
    expect(() => assertGradable({ ...ok, participantStatus: 'kicked' })).toThrow(ParticipantKickedError);
    expect(() => assertGradable({ ...ok, attemptSubmitted: false })).toThrow(NotSubmittedYetError);
    expect(() => assertGradable({ ...ok, score: 4.5 })).toThrow(ScoreOutOfRangeError);
    expect(() => assertGradable({ ...ok, questionPoints: 2.5, score: 3 })).toThrow('Điểm phải từ 0 đến 2,5');
  });

  it('feedback is trimmed and blank becomes null; the manual total sums graded answers', () => {
    expect(normalizeFeedback('  tốt  ')).toBe('tốt');
    expect(normalizeFeedback('   ')).toBeNull();
    expect(normalizeFeedback(undefined)).toBeNull();
    expect(manualTotal([{ manualScore: 1.5 }, { manualScore: null }, { manualScore: 2 }])).toBe(3.5);
  });
});

describe('leaderboard ranking', () => {
  const counted = new Map([
    [1, att({ id: 1, participantId: 1, submittedAt: new Date(30), autoScore: 3, manualScore: 2 })],
    [2, att({ id: 2, participantId: 2, submittedAt: new Date(10), autoScore: 4, manualScore: null })],
    [3, att({ id: 3, participantId: 3, submittedAt: new Date(10), autoScore: 4, manualScore: null })],
  ]);
  const names = new Map([[1, 'An'], [2, 'Bình'], [3, 'Cường']]);

  it('hides manual points until finalized; ties share a rank (1, 1, 3)', () => {
    const provisional = buildLeaderboard({ status: 'closed', totalPoints: 9, counted, names });
    expect(provisional.provisional).toBe(true);
    expect(provisional.entries.map(e => [e.displayName, e.score, e.rank])).toEqual([['Bình', 4, 1], ['Cường', 4, 1], ['An', 3, 3]]);
  });

  it('adds the manual part once finalized and reorders', () => {
    const final = buildLeaderboard({ status: 'finalized', totalPoints: 9, counted, names });
    expect(final.provisional).toBe(false);
    expect(final.entries.map(e => [e.displayName, e.score, e.rank])).toEqual([['An', 5, 1], ['Bình', 4, 2], ['Cường', 4, 2]]);
    expect(final.entries[0]!.maxScore).toBe(9);
  });
});
