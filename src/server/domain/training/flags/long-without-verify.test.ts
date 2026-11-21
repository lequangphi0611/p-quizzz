import { beforeEach, describe, expect, it } from 'vitest';
import { LONG_UNVERIFIED_EDITS, LONG_UNVERIFIED_MS, longWithoutVerify } from './long-without-verify.js';
import { ctx, resetEvents, tool } from './test-events.js';

beforeEach(resetEvents);
const edits = (n: number, spanMs: number) =>
  Array.from({ length: n }, (_, i) => tool('Edit', `src/f${i}.ts`, true, { atSec: (i * spanMs) / (n - 1) / 1000 }));

describe('longWithoutVerify', () => {
  it('goes up with enough edits over enough time and no successful check', () => {
    const events = edits(LONG_UNVERIFIED_EDITS, LONG_UNVERIFIED_MS);
    expect(longWithoutVerify(events, ctx())?.eventIds).toEqual(events.map(e => e.id));
  });
  it('stays down when too few edits, too little time, or a check passed in between', () => {
    expect(longWithoutVerify(edits(LONG_UNVERIFIED_EDITS - 1, LONG_UNVERIFIED_MS), ctx())).toBeNull();
    expect(longWithoutVerify(edits(LONG_UNVERIFIED_EDITS, LONG_UNVERIFIED_MS - 60_000), ctx())).toBeNull();
    const [first, ...rest] = edits(LONG_UNVERIFIED_EDITS, LONG_UNVERIFIED_MS);
    expect(longWithoutVerify([first!, tool('Bash', 'npm test', true, { atSec: 1 }), ...rest], ctx())).toBeNull();
  });
  it('a failed check does not reset the count', () => {
    const [first, ...rest] = edits(LONG_UNVERIFIED_EDITS, LONG_UNVERIFIED_MS);
    expect(longWithoutVerify([first!, tool('Bash', 'npm test', false, { atSec: 1 }), ...rest], ctx())).not.toBeNull();
  });
});
