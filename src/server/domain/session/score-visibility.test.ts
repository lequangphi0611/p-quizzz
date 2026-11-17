import { describe, expect, it } from 'vitest';
import type { SessionStatus } from '../../../shared/session-state.js';
import { ScoreVisibilityLockedError, ScoresNotHeldError } from './errors.js';
import { areScoresHidden, assertCanChangeScoreVisibility, assertCanReleaseScores } from './score-visibility.js';

const s = (status: SessionStatus, scoreVisibility: 'on_submit' | 'on_release' = 'on_release', scoresReleasedAt: Date | null = null) => ({ status, scoreVisibility, scoresReleasedAt });

describe('areScoresHidden', () => {
  it('hides only when held, not yet published, and the session is still open', () => {
    expect(['draft', 'lobby', 'running'].map(st => areScoresHidden(s(st as SessionStatus)))).toEqual([true, true, true]);
    expect(areScoresHidden(s('closed'))).toBe(false); // closing publishes
    expect(areScoresHidden(s('finalized'))).toBe(false);
    expect(areScoresHidden(s('running', 'on_submit'))).toBe(false);
    expect(areScoresHidden(s('running', 'on_release', new Date()))).toBe(false);
  });
});

describe('assertCanChangeScoreVisibility', () => {
  it('allows a change while open, unpublished and nobody has submitted', () => {
    expect(() => assertCanChangeScoreVisibility(s('running'), false)).not.toThrow();
    expect(() => assertCanChangeScoreVisibility(s('draft', 'on_submit'), false)).not.toThrow();
  });
  it('refuses after a submission, after publishing, or once the session ended', () => {
    expect(() => assertCanChangeScoreVisibility(s('running'), true)).toThrow(ScoreVisibilityLockedError);
    expect(() => assertCanChangeScoreVisibility(s('running', 'on_release', new Date()), false)).toThrow(ScoreVisibilityLockedError);
    expect(() => assertCanChangeScoreVisibility(s('closed'), false)).toThrow(ScoreVisibilityLockedError);
  });
});

describe('assertCanReleaseScores', () => {
  it('only while scores are held back', () => {
    expect(() => assertCanReleaseScores(s('running'))).not.toThrow();
    expect(() => assertCanReleaseScores(s('running', 'on_submit'))).toThrow(ScoresNotHeldError);
    expect(() => assertCanReleaseScores(s('closed'))).toThrow(ScoresNotHeldError);
  });
});
