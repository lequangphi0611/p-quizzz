import { describe, expect, it } from 'vitest';
import type { AttemptSummary, EditRequestInfo, MeResponse } from '../../../../shared/api/index.js';
import { checkReason, editPanelMode } from './edit-request.js';

const me = (over: { status?: 'running' | 'closed'; hasEssay?: boolean; submitted?: boolean; edit?: EditRequestInfo['status'] | null; can?: boolean } = {}) => {
  const { status = 'running', hasEssay = true, submitted = true, edit = null, can = true } = over;
  const done: AttemptSummary = { id: 1, attemptNo: 1, submittedAt: 1, score: 1, maxScore: 1, essayScore: null, canRequestEdit: can, editRequest: edit ? { status: edit, reason: 'r', requestedAt: 1, resolvedAt: null } : null };
  return { session: { status, hasEssay }, attempt: { submitted: submitted ? [done] : [] } } as unknown as MeResponse;
};

describe('editPanelMode', () => {
  it('shows nothing without an essay, a submission or a running session', () => {
    expect(editPanelMode(me({ hasEssay: false }))).toBe('none');
    expect(editPanelMode(me({ submitted: false }))).toBe('none');
    expect(editPanelMode(me({ status: 'closed' }))).toBe('none');
  });
  it('follows the state of the request', () => {
    expect(editPanelMode(me())).toBe('ask');
    expect(editPanelMode(me({ edit: 'pending', can: false }))).toBe('waiting');
    expect(editPanelMode(me({ edit: 'approved', can: false }))).toBe('editing');
    expect(editPanelMode(me({ edit: 'rejected' }))).toBe('retry');
    expect(editPanelMode(me({ edit: 'done', can: false }))).toBe('done');
  });
});

describe('checkReason', () => {
  it('trims, and rejects blank or over-long reasons', () => {
    expect(checkReason('  em quên ý  ')).toEqual({ ok: true, reason: 'em quên ý' });
    expect(checkReason('   ').ok).toBe(false);
    expect(checkReason('x'.repeat(501)).ok).toBe(false);
    expect(checkReason('x'.repeat(500)).ok).toBe(true);
  });
});
