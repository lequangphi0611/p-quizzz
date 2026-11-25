import { beforeEach, describe, expect, it } from 'vitest';
import { repeatedFailure } from './repeated-failure.js';
import { ctx, prompt, resetEvents, tool } from './test-events.js';

beforeEach(resetEvents);

describe('repeatedFailure', () => {
  it('goes up after three failures of the same target in a row (a prompt in between does not break it)', () => {
    const a = tool('Bash', 'npm test', false);
    const b = tool('Bash', 'npm test', false);
    prompt('again');
    const c = tool('Bash', 'npm test', false);
    expect(repeatedFailure([a, b, prompt('x'), c], ctx())).toEqual({ code: 'repeated_failure', eventIds: [a.id, b.id, c.id] });
  });
  it('stays down with two failures, a success in the run, or different targets', () => {
    expect(repeatedFailure([tool('Bash', 'a', false), tool('Bash', 'a', false)], ctx())).toBeNull();
    expect(repeatedFailure([tool('Bash', 'a', false), tool('Bash', 'a', false), tool('Bash', 'a', true), tool('Bash', 'a', false)], ctx())).toBeNull();
    expect(repeatedFailure([tool('Bash', 'a', false), tool('Bash', 'b', false), tool('Bash', 'a', false)], ctx())).toBeNull();
    expect(repeatedFailure([tool('Edit', null, false), tool('Edit', null, false), tool('Edit', null, false)], ctx())).toBeNull();
  });
  it('keeps going for a longer run', () => {
    const events = [1, 2, 3, 4].map(() => tool('Bash', 'x', false));
    expect(repeatedFailure(events, ctx())?.eventIds).toEqual(events.map(e => e.id));
  });

  it('runs per session: 3 failures in A with a success in B in between still goes up; 2 + 1 across sessions does not', () => {
    const a1 = tool('Bash', 'npm test', false, { claudeSessionId: 'A' });
    tool('Bash', 'npm test', true, { claudeSessionId: 'B' });
    const a2 = tool('Bash', 'npm test', false, { claudeSessionId: 'A' });
    tool('Bash', 'ls', true, { claudeSessionId: 'B' });
    const a3 = tool('Bash', 'npm test', false, { claudeSessionId: 'A' });
    const events = [a1, ...[tool('Bash', 'npm test', true, { claudeSessionId: 'B' })], a2, a3];
    expect(repeatedFailure(events, ctx())?.eventIds).toEqual([a1.id, a2.id, a3.id]);
    const mixed = [tool('Bash', 'x', false, { claudeSessionId: 'A' }), tool('Bash', 'x', false, { claudeSessionId: 'B' }), tool('Bash', 'x', false, { claudeSessionId: 'A' })];
    expect(repeatedFailure(mixed, ctx())).toBeNull();
  });
});
