import type { MeResponse } from '../../../../shared/api/index.js';
import { MAX_EDIT_REASON_LENGTH } from '../../../../shared/api/index.js';

/** What the member sees about editing their essays after submitting (PRODUCT.md §7.21). */
export type EditPanelMode = 'none' | 'ask' | 'retry' | 'waiting' | 'editing' | 'done';

export function editPanelMode(me: Pick<MeResponse, 'session' | 'attempt'>): EditPanelMode {
  const done = me.attempt.submitted[0];
  if (!done || !me.session.hasEssay || me.session.status !== 'running') return 'none';
  switch (done.editRequest?.status) {
    case 'pending': return 'waiting';
    case 'approved': return 'editing';
    case 'done': return 'done';
    case 'rejected': return done.canRequestEdit ? 'retry' : 'none';
    default: return done.canRequestEdit ? 'ask' : 'none';
  }
}

/** The reason as it will be sent: trimmed, or an error message for the form. */
export function checkReason(raw: string): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = raw.trim();
  if (!reason) return { ok: false, error: 'Hãy ghi lý do xin sửa bài' };
  if (reason.length > MAX_EDIT_REASON_LENGTH) return { ok: false, error: `Lý do tối đa ${MAX_EDIT_REASON_LENGTH} ký tự` };
  return { ok: true, reason };
}
