import { ScoreVisibilityLockedError, ScoresNotHeldError } from './errors.js';
import type { Session } from './session.js';

type Visibility = Pick<Session, 'status' | 'scoreVisibility' | 'scoresReleasedAt'>;

/**
 * PRODUCT.md §7.25: are members (and the projector) kept from seeing scores and ranks right now? Only when the session
 * holds scores back, the mentor has not published them yet, and the session has not closed (closing publishes them).
 */
export function areScoresHidden(s: Visibility): boolean {
  if (s.scoreVisibility !== 'on_release' || s.scoresReleasedAt) return false;
  return s.status === 'draft' || s.status === 'lobby' || s.status === 'running';
}

/**
 * The setting can change only while nobody has submitted: after that, someone may already have seen a score (or
 * missed one others saw), and switching would treat people differently. Published scores never hide again.
 */
export function assertCanChangeScoreVisibility(s: Visibility, anySubmitted: boolean): void {
  if (s.status === 'closed' || s.status === 'finalized') throw new ScoreVisibilityLockedError('ended');
  if (s.scoresReleasedAt) throw new ScoreVisibilityLockedError('released');
  if (anySubmitted) throw new ScoreVisibilityLockedError('submitted');
}

/** "Công bố điểm": only while scores are actually held back. */
export function assertCanReleaseScores(s: Visibility): void {
  if (!areScoresHidden(s)) throw new ScoresNotHeldError();
}
