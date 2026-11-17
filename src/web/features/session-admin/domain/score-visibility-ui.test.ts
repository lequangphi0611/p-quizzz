import { describe, expect, it } from 'vitest';
import type { SessionDetail, SessionParticipantDetail } from '../../../../shared/api/index.js';
import { scoreVisibilityState } from './score-visibility-ui.js';

const person = (submittedAt: number | null, status: SessionParticipantDetail['status'] = 'active') =>
  ({ status, progress: { submittedAt } }) as unknown as SessionParticipantDetail;
const detail = (over: Partial<SessionDetail> = {}) =>
  ({ status: 'running', scoreVisibility: 'on_release', scoresReleasedAt: null, scoresHidden: true, participants: [], ...over }) as SessionDetail;

describe('scoreVisibilityState', () => {
  it('can change and release while held and nobody has submitted', () => {
    expect(scoreVisibilityState(detail())).toEqual({ canChange: true, lockedReason: null, canRelease: true, submitted: 0 });
  });
  it('locks once someone submitted (a kicked person counts) but still allows publishing', () => {
    const s = scoreVisibilityState(detail({ participants: [person(null), person(1000, 'kicked')] }));
    expect([s.canChange, s.canRelease, s.submitted]).toEqual([false, true, 1]);
    expect(s.lockedReason).toMatch(/nộp/);
  });
  it('locks after publishing and after the session ended', () => {
    expect(scoreVisibilityState(detail({ scoresReleasedAt: 5, scoresHidden: false })).lockedReason).toMatch(/công bố/);
    const closed = scoreVisibilityState(detail({ status: 'closed', scoresHidden: false }));
    expect([closed.canChange, closed.canRelease]).toEqual([false, false]);
  });
  it('a session that shows scores on submit has nothing to publish', () => {
    expect(scoreVisibilityState(detail({ scoreVisibility: 'on_submit', scoresHidden: false })).canRelease).toBe(false);
  });
});
