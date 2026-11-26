import { describe, expect, it } from 'vitest';
import type { TrainingEventRow } from '../../../../shared/api/index.js';
import { buildTimeline, type Turn } from './timeline.js';
import {
  emptyReadState, markAllRead, markTurnsRead, maxEventId, newBadgeText, newCommandsOf, restoreMemberRead, turnNewness, unreadPromptCount, unreadTurnCount, withBaselines,
} from './unread.js';

let id = 0;
const ev = (kind: TrainingEventRow['kind'], receivedAt: number, extra: Partial<TrainingEventRow> = {}): TrainingEventRow =>
  ({ id: ++id, kind, receivedAt, claudeSessionId: 's1', hasOutput: false, hasChange: false, marked: false, teachingExample: null, exampleDraft: null, ...extra });
const turnsOf = (events: TrainingEventRow[]): Turn[] => buildTimeline(events, { memberStuck: false }).filter((i): i is Turn => i.kind === 'turn');
const member = (over: Partial<{ id: number; lastSeenAt: number | null; promptCount: number }> = {}) => ({ id: 1, lastSeenAt: 1000, promptCount: 2, ...over });

describe('the baseline: what a browser sees for the first time is already read', () => {
  it('records lastSeenAt and promptCount the first time a member is in the list, and never again', () => {
    const first = withBaselines(emptyReadState(), [member()]);
    expect(first.members['1']).toEqual({ baselineAt: 1000, baselinePromptCount: 2, readPromptCount: 0, turns: {} });
    expect(withBaselines(first, [member({ lastSeenAt: 9999, promptCount: 9 })])).toBe(first);
  });
  it('a member nothing was heard from starts at 0, so everything they send later is new', () => {
    const s = withBaselines(emptyReadState(), [member({ lastSeenAt: null, promptCount: 0 })]);
    expect(s.members['1']!.baselineAt).toBe(0);
  });
  it('events received up to the baseline are not new, later ones are', () => {
    id = 0;
    const old = ev('prompt', 900);
    const fresh = ev('prompt', 1100);
    const read = withBaselines(emptyReadState(), [member()]).members['1'];
    const [a, b] = turnsOf([old, fresh]);
    expect(turnNewness(a!, read).kind).toBe('none');
    expect(turnNewness(b!, read).kind).toBe('prompt');
    expect(unreadTurnCount([a!, b!], read)).toBe(1);
  });
  it('without a record nothing is new', () => {
    id = 0;
    expect(turnNewness(turnsOf([ev('prompt', 5000)])[0]!, undefined).kind).toBe('none');
  });
});

describe('reading a turn', () => {
  it('marks the turn up to the id given, and an event that came after stays new (an old prompt with new commands)', () => {
    id = 0;
    const p = ev('prompt', 2000);
    const t1 = ev('tool', 2100, { toolName: 'Bash', toolTarget: 'a' });
    const late = ev('tool', 2200, { toolName: 'Bash', toolTarget: 'b' });
    const turn = turnsOf([p, t1, late])[0]!;
    let s = withBaselines(emptyReadState(), [member()]);
    s = markTurnsRead(s, 1, [{ turn, maxId: t1.id }]); // the mentor read up to t1; `late` arrived during the 2 seconds
    const n = turnNewness(turn, s.members['1']);
    expect(n.kind).toBe('events');
    expect(newCommandsOf(n).map(e => e.id)).toEqual([late.id]);
    s = markTurnsRead(s, 1, [{ turn, maxId: maxEventId(turn) }]);
    expect(turnNewness(turn, s.members['1']).kind).toBe('none');
  });
  it('a command arriving in an already read prompt is "events", not a new prompt', () => {
    id = 0;
    const p = ev('prompt', 2000);
    const t = turnsOf([p])[0]!;
    let s = markTurnsRead(withBaselines(emptyReadState(), [member()]), 1, [{ turn: t, maxId: p.id }]);
    const after = turnsOf([p, ev('tool', 3000)])[0]!;
    expect(turnNewness(after, s.members['1']).kind).toBe('events');
    s = markTurnsRead(s, 1, [{ turn: after, maxId: maxEventId(after) }]);
    expect(turnNewness(after, s.members['1']).kind).toBe('none');
  });
  it('notices never make a turn new, and a mark never goes down', () => {
    id = 0;
    const p = ev('prompt', 2000);
    const turn = turnsOf([p, ev('notice', 2100, { subtype: 'idle' })])[0]!;
    let s = markTurnsRead(withBaselines(emptyReadState(), [member()]), 1, [{ turn, maxId: p.id }]);
    expect(turnNewness(turn, s.members['1']).kind).toBe('none');
    const again = markTurnsRead(s, 1, [{ turn, maxId: 1 }]);
    expect(again).toBe(s);
    s = again;
    expect(s.members['1']!.turns[String(turn.firstId)]).toBe(p.id);
  });
  it('a turn without a prompt is new through its commands', () => {
    id = 0;
    const turn = turnsOf([ev('tool', 2000, { toolName: 'Bash' })])[0]!;
    expect(turnNewness(turn, withBaselines(emptyReadState(), [member()]).members['1']).kind).toBe('events');
  });
});

describe('the number beside a member in the list', () => {
  it('counts new prompts not read yet, never below 0, and nothing for old prompts or new commands', () => {
    id = 0;
    let s = withBaselines(emptyReadState(), [member({ promptCount: 2 })]);
    expect(unreadPromptCount({ id: 1, promptCount: 2 }, s)).toBe(0);
    expect(unreadPromptCount({ id: 1, promptCount: 5 }, s)).toBe(3);
    const p = ev('prompt', 2000);
    const turn = turnsOf([p])[0]!;
    s = markTurnsRead(s, 1, [{ turn, maxId: p.id }]);
    expect(unreadPromptCount({ id: 1, promptCount: 5 }, s)).toBe(2);
    expect(unreadPromptCount({ id: 1, promptCount: 2 }, s)).toBe(0); // e.g. after a purge: never negative
    expect(unreadPromptCount({ id: 7, promptCount: 9 }, s)).toBe(0); // no record
  });
  it('reading a turn whose prompt is before the baseline does not lower the count', () => {
    id = 0;
    const old = ev('prompt', 500);
    const turn = turnsOf([old])[0]!;
    const s = markTurnsRead(withBaselines(emptyReadState(), [member({ promptCount: 1 })]), 1, [{ turn, maxId: old.id }]);
    expect(unreadPromptCount({ id: 1, promptCount: 3 }, s)).toBe(2);
  });
  it('shows 99+ from 100', () => {
    expect(newBadgeText(5)).toBe('5 mới');
    expect(newBadgeText(99)).toBe('99 mới');
    expect(newBadgeText(100)).toBe('99+ mới');
  });
});

describe('"Đánh dấu đã đọc hết" and its undo', () => {
  it('reads every loaded turn; when everything is loaded the list shows nothing until a new prompt', () => {
    id = 0;
    const events = [ev('prompt', 2000), ev('tool', 2100), ev('prompt', 3000)];
    const turns = turnsOf(events);
    const before = withBaselines(emptyReadState(), [member({ promptCount: 0, lastSeenAt: 100 })]);
    expect(unreadTurnCount(turns, before.members['1'])).toBe(2);
    const after = markAllRead(before, { id: 1 }, turns, true);
    expect(unreadTurnCount(turns, after.members['1'])).toBe(0);
    expect(unreadPromptCount({ id: 1, promptCount: 2 }, after)).toBe(0);
    expect(unreadPromptCount({ id: 1, promptCount: 3 }, after)).toBe(1);
    const undone = restoreMemberRead(after, 1, before.members['1']);
    expect(unreadTurnCount(turns, undone.members['1'])).toBe(2);
    expect(unreadPromptCount({ id: 1, promptCount: 2 }, undone)).toBe(2);
  });
  it('settles on the prompts that were loaded, whichever of the member list and the timeline is newer', () => {
    id = 0;
    const turns = turnsOf([ev('prompt', 2000), ev('prompt', 3000)]);
    const before = withBaselines(emptyReadState(), [member({ promptCount: 0, lastSeenAt: 100 })]);
    const after = markAllRead(before, { id: 1 }, turns, true);
    expect(unreadPromptCount({ id: 1, promptCount: 2 }, after)).toBe(0); // the list is in step
    expect(unreadPromptCount({ id: 1, promptCount: 3 }, after)).toBe(1); // the list already counts a prompt that is not loaded yet
    expect(unreadPromptCount({ id: 1, promptCount: 1 }, after)).toBe(0); // the list is older than the timeline: never below 0 ...
    expect(unreadPromptCount({ id: 1, promptCount: 2 }, after)).toBe(0); // ... and once it catches up, still nothing
  });
  it('when only part of the timeline is loaded, the prompts not loaded stay counted', () => {
    id = 0;
    const turns = turnsOf([ev('prompt', 2000)]);
    const s = markAllRead(withBaselines(emptyReadState(), [member({ promptCount: 0, lastSeenAt: 100 })]), { id: 1 }, turns, false);
    expect(unreadPromptCount({ id: 1, promptCount: 5 }, s)).toBe(4);
  });
});
