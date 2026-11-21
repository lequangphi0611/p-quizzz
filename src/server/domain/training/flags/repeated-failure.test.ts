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
});
