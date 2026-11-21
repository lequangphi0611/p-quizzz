import { describe, expect, it } from 'vitest';
import type { TrainingEventRow } from '../../../../shared/api/index.js';
import { buildTimeline, stepEvent, type TimelineItem } from './timeline.js';

let id = 0;
const prompt = (text: string, session = 's1'): TrainingEventRow => ({ id: ++id, kind: 'prompt', receivedAt: id * 1000, claudeSessionId: session, prompt: text, hasOutput: false, hasChange: false, marked: false });
const tool = (name: string, target: string | undefined, ok: boolean, extra: Partial<TrainingEventRow> = {}, session = 's1'): TrainingEventRow =>
  ({ id: ++id, kind: 'tool', receivedAt: id * 1000, claudeSessionId: session, toolName: name, ...(target !== undefined ? { toolTarget: target } : {}), ok, durationMs: 10, hasOutput: false, hasChange: false, marked: false, ...extra });

const turns = (items: TimelineItem[]) => items.filter((i): i is Extract<TimelineItem, { kind: 'turn' }> => i.kind === 'turn');

describe('buildTimeline', () => {
  it('groups commands under the prompt that came before them, numbering prompts', () => {
    id = 0;
    const events = [prompt('một'), tool('Read', 'a.ts', true), tool('Bash', 'npm test', false), prompt('hai'), tool('Edit', 'a.ts', true)];
    const items = buildTimeline(events, { memberStuck: false });
    expect(items.map(i => i.kind)).toEqual(['turn', 'turn']);
    expect(turns(items).map(t => [t.promptNumber, t.prompt?.prompt, t.tools.length])).toEqual([[1, 'một', 2], [2, 'hai', 1]]);
  });

  it('puts commands that arrive before any prompt in a turn without a prompt', () => {
    id = 0;
    const items = buildTimeline([tool('Bash', 'ls', true), prompt('x')], { memberStuck: false });
    expect(turns(items).map(t => [t.promptNumber, t.tools.length])).toEqual([[null, 1], [1, 0]]);
  });

  it('adds dividers between Claude Code sessions only when there is more than one', () => {
    id = 0;
    const one = buildTimeline([prompt('a'), tool('Bash', 'ls', true)], { memberStuck: false });
    expect(one.some(i => i.kind === 'session')).toBe(false);

    id = 0;
    const many = buildTimeline([prompt('a', 'A'), tool('Bash', 'ls', true, {}, 'A'), tool('Bash', 'pwd', true, {}, 'B'), prompt('b', 'B'), prompt('c', 'A')], { memberStuck: false });
    expect(many.map(i => (i.kind === 'session' ? `session ${i.index}` : 'turn'))).toEqual(['session 1', 'turn', 'session 2', 'turn', 'turn', 'session 1', 'turn']);
    // commands of the new session never stay in the previous session's turn
    expect(turns(many)[1]!.prompt).toBeNull();
  });

  it('flags three failures of the same command in a row, at the first line of the run', () => {
    id = 0;
    const events = [prompt('p'), tool('Bash', 'npm test', false), tool('Edit', 'a.ts', true), tool('Bash', 'npm test', false), tool('Bash', 'npm test', false), prompt('q'), tool('Bash', 'npm test', false)];
    const flat = turns(buildTimeline(events, { memberStuck: true })).flatMap(t => t.tools);
    // the success in between cuts the first failure off; a prompt in between does not cut the run
    expect(flat.map(t => t.run)).toEqual([null, null, { start: true, length: 3, active: true }, { start: false, length: 3, active: true }, { start: false, length: 3, active: true }]);
  });

  it('two failures are not a run; a different target or a success cuts it', () => {
    id = 0;
    const events = [tool('Bash', 'npm test', false), tool('Bash', 'npm test', false), tool('Bash', 'npm run lint', false), tool('Bash', 'npm test', false)];
    expect(turns(buildTimeline(events, { memberStuck: false })).flatMap(t => t.tools).every(t => t.run === null)).toBe(true);
  });

  it('a command without a target is never a repeat', () => {
    id = 0;
    const events = [tool('Task', undefined, false), tool('Task', undefined, false), tool('Task', undefined, false)];
    expect(turns(buildTimeline(events, { memberStuck: true })).flatMap(t => t.tools).every(t => t.run === null)).toBe(true);
  });

  it('an older run is shown but only the run at the end is "active", and only while the member is flagged', () => {
    id = 0;
    const old = [tool('Bash', 'a', false), tool('Bash', 'a', false), tool('Bash', 'a', false), tool('Bash', 'a', true)];
    const flat = (stuck: boolean) => turns(buildTimeline(old, { memberStuck: stuck })).flatMap(t => t.tools).map(t => t.run?.active ?? null);
    expect(flat(true)).toEqual([false, false, false, null]);

    id = 0;
    const now = [tool('Bash', 'a', false), tool('Bash', 'a', false), tool('Bash', 'a', false)];
    expect(turns(buildTimeline(now, { memberStuck: false })).flatMap(t => t.tools).map(t => t.run?.active)).toEqual([false, false, false]);
    expect(turns(buildTimeline(now, { memberStuck: true })).flatMap(t => t.tools).map(t => t.run?.active)).toEqual([true, true, true]);
  });
});

describe('stepEvent', () => {
  it('steps over commands that have something to open, and stops at the ends', () => {
    id = 0;
    const a = tool('Bash', 'a', true, { hasOutput: true });
    const skip = tool('Read', 'b', true);
    const b = tool('Write', 'c', true, { hasChange: true });
    const events = [prompt('p'), a, skip, b];
    expect(stepEvent(events, a.id, 1)?.id).toBe(b.id);
    expect(stepEvent(events, b.id, -1)?.id).toBe(a.id);
    expect(stepEvent(events, a.id, -1)).toBeNull();
    expect(stepEvent(events, b.id, 1)).toBeNull();
    expect(stepEvent(events, 9999, 1)).toBeNull();
  });
});

describe('rows other than commands', () => {
  const row = (kind: TrainingEventRow['kind'], extra: Partial<TrainingEventRow> = {}): TrainingEventRow => ({ id: ++id, kind, receivedAt: id * 1000, claudeSessionId: 's1', hasOutput: false, hasChange: false, marked: false, ...extra });

  it('permission requests, session markers and notices sit under the prompt that was running, in order', () => {
    id = 0;
    const events = [prompt('p'), row('permission', { toolName: 'Bash', toolTarget: 'ls', decision: 'allowed' }), tool('Bash', 'ls', true), row('notice', { subtype: 'idle' }), row('session', { subtype: 'clear' })];
    const [turn] = turns(buildTimeline(events, { memberStuck: false }));
    expect(turn!.tools.map(t => t.event.kind)).toEqual(['permission', 'tool', 'notice', 'session']);
  });

  it('never makes a stuck run out of permission requests', () => {
    id = 0;
    const same = () => row('permission', { toolName: 'Bash', toolTarget: 'x', ok: false });
    expect(turns(buildTimeline([same(), same(), same()], { memberStuck: true })).flatMap(t => t.tools).every(t => t.run === null)).toBe(true);
  });

  it('J / K also stop at a permission request that has a change to open', () => {
    id = 0;
    const a = tool('Bash', 'a', true, { hasOutput: true });
    const p = row('permission', { toolName: 'Edit', toolTarget: 'x.ts', hasChange: true });
    const events = [a, row('notice', { subtype: 'idle' }), p];
    expect(stepEvent(events, a.id, 1)?.id).toBe(p.id);
  });
});
