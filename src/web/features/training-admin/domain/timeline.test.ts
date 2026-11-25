import { describe, expect, it } from 'vitest';
import type { TrainingEventRow } from '../../../../shared/api/index.js';
import { stepEvent } from './day-groups.js';
import { buildTimeline, sessionIndexes, turnKeyOf, type TimelineItem } from './timeline.js';

let id = 0;
const prompt = (text: string, session = 's1'): TrainingEventRow => ({ id: ++id, kind: 'prompt', receivedAt: id * 1000, claudeSessionId: session, prompt: text, hasOutput: false, hasChange: false, marked: false, teachingExample: null });
const tool = (name: string, target: string | undefined, ok: boolean, extra: Partial<TrainingEventRow> = {}, session = 's1'): TrainingEventRow =>
  ({ id: ++id, kind: 'tool', receivedAt: id * 1000, claudeSessionId: session, toolName: name, ...(target !== undefined ? { toolTarget: target } : {}), ok, durationMs: 10, hasOutput: false, hasChange: false, marked: false, teachingExample: null, ...extra });

const turns = (items: TimelineItem[]) => items.filter((i): i is Extract<TimelineItem, { kind: 'turn' }> => i.kind === 'turn');

describe('buildTimeline', () => {
  it('groups commands under the prompt that came before them, numbering prompts', () => {
    id = 0;
    const events = [prompt('một'), tool('Read', 'a.ts', true), tool('Bash', 'npm test', false), prompt('hai'), tool('Edit', 'a.ts', true)];
    const items = buildTimeline(events, { memberStuck: false });
    expect(items.map(i => i.kind)).toEqual(['day', 'turn', 'turn']);
    expect(turns(items).map(t => [t.promptNumber, t.prompt?.prompt, t.tools.length])).toEqual([[1, 'một', 2], [2, 'hai', 1]]);
  });

  it('puts commands that arrive before any prompt in a turn without a prompt', () => {
    id = 0;
    const items = buildTimeline([tool('Bash', 'ls', true), prompt('x')], { memberStuck: false });
    expect(turns(items).map(t => [t.promptNumber, t.tools.length])).toEqual([[null, 1], [1, 0]]);
  });

  it('two interleaved sessions: each command sits under the prompt of its own session, with no empty turn', () => {
    id = 0;
    // A prompt, B prompt, A command, B command, A command
    const events = [prompt('a', 'A'), prompt('b', 'B'), tool('Bash', 'a1', true, {}, 'A'), tool('Bash', 'b1', true, {}, 'B'), tool('Bash', 'a2', true, {}, 'A')];
    const t = turns(buildTimeline(events, { memberStuck: false }));
    expect(t.map(x => [x.prompt?.prompt, x.claudeSessionId, x.sessionIndex, x.tools.map(y => y.event.toolTarget)])).toEqual([
      ['a', 'A', 1, ['a1', 'a2']],
      ['b', 'B', 2, ['b1']],
    ]);
    expect(t.every(x => x.prompt !== null)).toBe(true);
    expect(t.map(x => x.promptNumber)).toEqual([1, 2]); // numbered over the whole training
  });

  it('numbers the sessions over the whole training by their first event; no divider items exist any more', () => {
    id = 0;
    const events = [tool('Bash', 'x', true, {}, 'B'), prompt('a', 'A'), prompt('b', 'B')];
    expect([...sessionIndexes(events)]).toEqual([['B', 1], ['A', 2]]);
    expect(buildTimeline(events, { memberStuck: false }).every(i => i.kind === 'day' || i.kind === 'turn')).toBe(true);
  });

  it('a turn "before the first prompt" exists only for a session that really ran commands before its own first prompt', () => {
    id = 0;
    const events = [prompt('a', 'A'), prompt('b', 'B'), tool('Bash', 'x', true, {}, 'B')];
    expect(turns(buildTimeline(events, { memberStuck: false })).filter(t => t.prompt === null)).toHaveLength(0);
    id = 0;
    const early = [prompt('a', 'A'), tool('Bash', 'x', true, {}, 'B'), prompt('b', 'B')];
    expect(turns(buildTimeline(early, { memberStuck: false })).map(t => [t.claudeSessionId, t.prompt === null])).toEqual([['A', false], ['B', true], ['B', false]]);
  });

  it('a failing run is cut per session: 3 failures in A with a success in B between still make a run, 2 + 1 across sessions do not', () => {
    id = 0;
    const events = [tool('Bash', 'npm test', false, {}, 'A'), tool('Bash', 'ls', true, {}, 'B'), tool('Bash', 'npm test', false, {}, 'A'), tool('Bash', 'ls', true, {}, 'B'), tool('Bash', 'npm test', false, {}, 'A')];
    const runs = turns(buildTimeline(events, { memberStuck: true })).flatMap(t => t.tools).map(t => t.run?.length ?? null);
    expect(runs).toEqual([3, 3, 3, null, null]); // session A's turn, then session B's
    id = 0;
    const mixed = [tool('Bash', 'x', false, {}, 'A'), tool('Bash', 'x', false, {}, 'B'), tool('Bash', 'x', false, {}, 'A')];
    expect(turns(buildTimeline(mixed, { memberStuck: true })).flatMap(t => t.tools).every(t => t.run === null)).toBe(true);
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
  const row = (kind: TrainingEventRow['kind'], extra: Partial<TrainingEventRow> = {}): TrainingEventRow => ({ id: ++id, kind, receivedAt: id * 1000, claudeSessionId: 's1', hasOutput: false, hasChange: false, marked: false, teachingExample: null, ...extra });

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

describe('finding the turn of an event', () => {
  it('turnKeyOf finds the turn of a prompt or of a command, and null for an unknown event', () => {
    const a = prompt('một');
    const t1 = tool('Bash', 'ls', true);
    const b = prompt('hai');
    const t2 = tool('Bash', 'pwd', true);
    const events = [a, t1, b, t2];
    expect(turnKeyOf(events, t1.id)).toBe(`t${a.id}`);
    expect(turnKeyOf(events, a.id)).toBe(`t${a.id}`);
    expect(turnKeyOf(events, t2.id)).toBe(`t${b.id}`);
    expect(turnKeyOf(events, 9999)).toBeNull();
  });
});

describe('buildTimeline: days (PRODUCT.md §7.37)', () => {
  const at = (d: number, h: number, mi = 0) => new Date(2026, 10, d, h, mi).getTime();
  const p = (text: string, receivedAt: number, session = 's1'): TrainingEventRow => ({ ...prompt(text, session), receivedAt });
  const t = (receivedAt: number, session = 's1'): TrainingEventRow => ({ ...tool('Bash', 'ls', true, {}, session), receivedAt });
  const shape = (items: TimelineItem[]) => items.map(i => (i.kind === 'day' ? `day ${i.dayKey}` : `turn ${i.promptNumber}`));

  it('puts one day strip before the first item of each day, also for the first day and for a single day', () => {
    id = 0;
    expect(shape(buildTimeline([p('a', at(23, 9)), p('b', at(23, 10))], { memberStuck: false }))).toEqual(['day 2026-11-23', 'turn 1', 'turn 2']);
    id = 0;
    expect(shape(buildTimeline([p('a', at(23, 9)), p('b', at(24, 10)), p('c', at(24, 11)), p('d', at(26, 8))], { memberStuck: false })))
      .toEqual(['day 2026-11-23', 'turn 1', 'day 2026-11-24', 'turn 2', 'turn 3', 'day 2026-11-26', 'turn 4']);
  });

  it('keeps a turn whole under the day of its prompt when a command runs after midnight', () => {
    id = 0;
    const items = buildTimeline([p('late', at(23, 23, 58)), t(at(24, 0, 3)), p('next', at(24, 9))], { memberStuck: false });
    expect(shape(items)).toEqual(['day 2026-11-23', 'turn 1', 'day 2026-11-24', 'turn 2']);
    expect(turns(items)[0]!.tools).toHaveLength(1);
  });

  it('dates the "before the first prompt" turn by its first event', () => {
    id = 0;
    const items = buildTimeline([t(at(23, 8)), p('x', at(24, 9))], { memberStuck: false });
    expect(shape(items)).toEqual(['day 2026-11-23', 'turn null', 'day 2026-11-24', 'turn 1']);
  });
});
