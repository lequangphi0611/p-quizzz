import { beforeEach, describe, expect, it } from 'vitest';
import { FAST_APPROVAL_COUNT, FAST_APPROVAL_MS, fastApprovals } from './fast-approvals.js';
import { ctx, perm, resetEvents } from './test-events.js';

beforeEach(resetEvents);
const decide = (events: ReturnType<typeof perm>[], ms: (number | null)[]) =>
  ctx({ decisions: new Map(events.map((e, i) => [e.id, { decision: ms[i] === null ? 'denied' : 'allowed', decisionMs: ms[i]! }])) });

describe('fastApprovals', () => {
  it('goes up with enough requests allowed in under the limit', () => {
    const events = Array.from({ length: FAST_APPROVAL_COUNT }, () => perm('Bash', 'ls'));
    expect(fastApprovals(events, decide(events, events.map(() => FAST_APPROVAL_MS - 1)))?.eventIds).toEqual(events.map(e => e.id));
  });
  it('stays down when too few, too slow, or denied', () => {
    const events = Array.from({ length: FAST_APPROVAL_COUNT }, () => perm('Bash', 'ls'));
    expect(fastApprovals(events.slice(1), decide(events.slice(1), [100, 100]))).toBeNull();
    expect(fastApprovals(events, decide(events, [100, 100, FAST_APPROVAL_MS]))).toBeNull();
    expect(fastApprovals(events, decide(events, [100, 100, null]))).toBeNull();
  });
});
