import { beforeEach, describe, expect, it } from 'vitest';
import { computeFlags } from './index.js';
import { perm, prompt, resetEvents, session, tool } from './test-events.js';

beforeEach(resetEvents);

describe('computeFlags', () => {
  it('returns nothing for a quiet timeline', () => {
    expect(computeFlags([prompt('viết hàm cộng'), tool('Edit', 'a.ts'), tool('Bash', 'npm test')], { allowAutoAccept: false })).toEqual([]);
  });
  it('lists the flags that are up, in a stable order, with the permission decisions inferred inside', () => {
    const events = [
      prompt('x'), perm('Bash', 'ls', 1), tool('Bash', 'ls', true, { atSec: 1 }), perm('Bash', 'ls', 2), tool('Bash', 'ls', true, { atSec: 2 }),
      perm('Bash', 'ls', 3), tool('Bash', 'ls', true, { atSec: 3 }), session('compact_auto'), session('compact_auto'),
    ];
    expect(computeFlags(events, { allowAutoAccept: false }).map(f => f.code)).toEqual(['fast_approvals', 'auto_compact_repeated']);
  });
});
