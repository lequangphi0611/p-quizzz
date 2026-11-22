import { beforeEach, describe, expect, it } from 'vitest';
import { editedNotVerified } from './edited-not-verified.js';
import { ctx, prompt, resetEvents, tool } from './test-events.js';

beforeEach(resetEvents);

describe('editedNotVerified', () => {
  it('goes up when two turns edited files and moved on without running any check', () => {
    const e1 = tool('Edit', 'a.ts');
    const e2 = tool('Write', 'b.ts');
    const events = [prompt('1'), e1, prompt('2'), e2, prompt('3')];
    expect(editedNotVerified(events, ctx())).toEqual({ code: 'edited_not_verified', eventIds: [e1.id, e2.id] });
  });
  it('stays down with one such turn, or when the turns ran a check (even a failing one)', () => {
    expect(editedNotVerified([prompt('1'), tool('Edit', 'a.ts'), prompt('2')], ctx())).toBeNull();
    const checked = [prompt('1'), tool('Edit', 'a.ts'), tool('Bash', 'npm test', false), prompt('2'), tool('Edit', 'b.ts'), tool('Bash', 'tsc --noEmit'), prompt('3')];
    expect(editedNotVerified(checked, ctx())).toBeNull();
  });
  it('the last turn does not count until another prompt follows it', () => {
    expect(editedNotVerified([prompt('1'), tool('Edit', 'a.ts'), prompt('2'), tool('Edit', 'b.ts')], ctx())).toBeNull();
  });
});
