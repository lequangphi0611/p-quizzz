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

  it('needs enough fast approvals within one session', () => {
    const events = [perm('Bash', 'ls', 1, 'A'), perm('Bash', 'ls', 2, 'B'), perm('Bash', 'ls', 3, 'A'), perm('Bash', 'ls', 4, 'B'), perm('Bash', 'ls', 5, 'A')];
    const fast = decide(events, events.map(() => 100));
    expect(fastApprovals(events, fast)?.eventIds).toEqual([events[0]!.id, events[2]!.id, events[4]!.id]);
    expect(fastApprovals(events.slice(0, 4), decide(events.slice(0, 4), [100, 100, 100, 100]))).toBeNull();
  });
});
