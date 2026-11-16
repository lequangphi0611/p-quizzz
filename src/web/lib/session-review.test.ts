import { describe, expect, it } from 'vitest';
import type { SessionParticipantDetail } from '../../shared/api/index.js';
import { defaultSelection, summarize } from './session-review.js';

const p = (id: number, status: SessionParticipantDetail['status'], state: 'none' | 'doing' | 'submitted', score: number | null): SessionParticipantDetail => ({
  id, displayName: `P${id}`, status, joinedAt: id, progress: { state, attempts: state === 'none' ? 0 : 1, countedScore: score, maxScore: 10, submittedAt: null },
});

describe('summarize', () => {
  it('counts everyone listed, the admitted ones, the submitters, and averages their scores', () => {
    const s = summarize([p(1, 'active', 'submitted', 8), p(2, 'active', 'submitted', 6), p(3, 'active', 'none', null), p(4, 'kicked', 'submitted', 10), p(5, 'pending', 'none', null)]);
    expect(s).toEqual({ total: 5, joined: 3, submitted: 2, average: 7 }); // the kicked 10 is not in the average
  });
  it('average is null when nobody has submitted', () => {
    expect(summarize([p(1, 'active', 'doing', null)]).average).toBeNull();
    expect(summarize([]).average).toBeNull();
  });
});

describe('defaultSelection', () => {
  it('picks the best submitter (ties → first), ignoring kicked people', () => {
    expect(defaultSelection([p(1, 'active', 'submitted', 5), p(2, 'active', 'submitted', 9), p(3, 'kicked', 'submitted', 10)])).toBe(2);
    expect(defaultSelection([p(1, 'active', 'submitted', 5), p(2, 'active', 'submitted', 5)])).toBe(1);
  });
  it('falls back to an admitted member, then anyone, then nothing', () => {
    expect(defaultSelection([p(1, 'pending', 'none', null), p(2, 'active', 'none', null)])).toBe(2);
    expect(defaultSelection([p(7, 'kicked', 'none', null)])).toBe(7);
    expect(defaultSelection([])).toBeNull();
  });
});
