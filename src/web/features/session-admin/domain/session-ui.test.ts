import { describe, expect, it } from 'vitest';
import { nextStatus, type SessionStatus } from '../../../../shared/session-state.js';
import { ACTION_FOR_STATUS, formatProgressScore, progressLabelOf, suggestSessionName } from './session-ui.js';

describe('ACTION_FOR_STATUS', () => {
  it('every offered action is valid for its status, and finalized offers none', () => {
    for (const [status, spec] of Object.entries(ACTION_FOR_STATUS) as [SessionStatus, (typeof ACTION_FOR_STATUS)[SessionStatus]][]) {
      if (spec) expect(nextStatus(status, spec.action), status).not.toBeNull();
      else expect(status).toBe('finalized');
    }
  });

  it('start, close and finalize (irreversible) ask for confirmation; opening the lobby does not', () => {
    const confirming = Object.values(ACTION_FOR_STATUS).filter(s => s?.confirm).map(s => s!.action);
    expect(confirming).toEqual(['start', 'close', 'finalize']);
  });

  it('the start confirmation mentions how many people are waiting', () => {
    expect(ACTION_FOR_STATUS.lobby!.confirm!.body(7)).toContain('7 người');
  });
});

describe('formatProgressScore', () => {
  const p = (countedScore: number | null) => ({ state: 'submitted' as const, attempts: 1, countedScore, maxScore: 9, submittedAt: null, editRequest: null, answered: null });
  it('shows score/max with a decimal comma', () => {
    expect(formatProgressScore(p(7.5))).toBe('7,5/9');
    expect(formatProgressScore(p(0))).toBe('0/9');
  });
  it('shows a dash until something is submitted', () => expect(formatProgressScore(p(null))).toBe('—'));
});

describe('progressLabelOf', () => {
  const sub = (editStatus?: 'pending' | 'approved' | 'done' | 'rejected') => ({ state: 'submitted' as const, attempts: 1, countedScore: 1, maxScore: 9, submittedAt: 1, editRequest: editStatus ? { status: editStatus, reason: 'r', requestedAt: 1, resolvedAt: null } : null, answered: null });
  it('refines "Đã nộp" by the state of the edit request', () => {
    expect(progressLabelOf(sub(), 20).label).toBe('Đã nộp');
    expect(progressLabelOf(sub('pending'), 20).label).toBe('Đã nộp · xin sửa');
    expect(progressLabelOf(sub('approved'), 20).label).toBe('Đang sửa tự luận');
    expect(progressLabelOf(sub('done'), 20).label).toBe('Đã sửa tự luận');
    expect(progressLabelOf(sub('rejected'), 20).label).toBe('Đã nộp');
  });
  it('ignores an edit request on someone who has not submitted', () => {
    expect(progressLabelOf({ ...sub('pending'), state: 'doing' }, 20).label).toBe('Đang làm');
  });
  it('shows answered/total while an attempt is in progress (PRODUCT.md §7.26)', () => {
    expect(progressLabelOf({ ...sub(), state: 'doing', answered: 7 }, 20).label).toBe('Đang làm · 7/20');
    expect(progressLabelOf({ ...sub(), state: 'doing', answered: 0 }, 20).label).toBe('Đang làm · 0/20');
    expect(progressLabelOf({ ...sub(), answered: 7 }, 20).label).toBe('Đã nộp');
  });
});

describe('suggestSessionName', () => {
  it('matches the server default: "<exam> – dd/MM"', () => {
    expect(suggestSessionName('Ôn tập Git', new Date(2026, 10, 5))).toBe('Ôn tập Git – 05/11');
  });
});
