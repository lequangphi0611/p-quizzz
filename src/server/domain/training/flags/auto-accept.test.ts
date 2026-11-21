import { beforeEach, describe, expect, it } from 'vitest';
import { autoAccept } from './auto-accept.js';
import { ctx, prompt, resetEvents } from './test-events.js';

beforeEach(resetEvents);
const inMode = (mode: string | null) => ({ ...prompt('x'), permissionMode: mode });

describe('autoAccept', () => {
  it('goes up on the first event of each stretch in an auto mode', () => {
    const a = inMode('acceptEdits');
    const events = [inMode('default'), a, inMode('acceptEdits'), inMode('default'), inMode('bypassPermissions')];
    expect(autoAccept(events, ctx())).toEqual({ code: 'auto_accept', eventIds: [a.id, events[4]!.id] });
  });
  it('stays down in default and plan mode, and with no mode', () => {
    expect(autoAccept([inMode('default'), inMode('plan'), inMode(null)], ctx())).toBeNull();
  });
  it('stays down when the mentor allowed auto-accept for the training', () => {
    expect(autoAccept([inMode('bypassPermissions')], ctx({ allowAutoAccept: true }))).toBeNull();
  });
});
