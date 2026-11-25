import { cap, perSession, type FlagRule } from './flag-event.js';

export const FAST_APPROVAL_MS = 2000;
export const FAST_APPROVAL_COUNT = 3;

/** "Đồng ý quyền rất nhanh": at least `FAST_APPROVAL_COUNT` requests answered "yes" in under `FAST_APPROVAL_MS`: probably not read. */
const fastApprovalsIn: FlagRule = (events, ctx) => {
  const ids = events
    .filter(e => e.kind === 'permission')
    .filter(e => {
      const d = ctx.decisions.get(e.id);
      return d?.decision === 'allowed' && d.decisionMs !== null && d.decisionMs < FAST_APPROVAL_MS;
    })
    .map(e => e.id);
  return ids.length >= FAST_APPROVAL_COUNT ? { code: 'fast_approvals', eventIds: cap(ids) } : null;
};

/** Per Claude Code session (PRODUCT.md §7.38c). */
export const fastApprovals: FlagRule = perSession(fastApprovalsIn);
