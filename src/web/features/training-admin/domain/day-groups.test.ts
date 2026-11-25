import { describe, expect, it } from 'vitest';
import type { TrainingEventRow } from '../../../../shared/api/index.js';
import { dayFlags, dayGroupSpoken, dayGroupsOf, groupByDay, newestPromptOf, placeOfTurn, placesByEvent, reconcileOpenBlocks, reconcileOpenDays, stepEvent, turnsOfDay, withDayOpen } from './day-groups.js';
import { blockEnd } from './session-blocks.js';
import { buildTimeline } from './timeline.js';

// Local-time moments, so the tests do not depend on the machine's time zone.
const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

let id = 0;
const ev = (kind: 'prompt' | 'tool', receivedAt: number, extra: Partial<TrainingEventRow> = {}): TrainingEventRow =>
  ({ id: ++id, kind, receivedAt, claudeSessionId: 's1', hasOutput: false, hasChange: false, marked: false, teachingExample: null, ...(kind === 'tool' ? { ok: true } : {}), ...extra });
const groupsOf = (events: TrainingEventRow[]) => groupByDay(buildTimeline(events, { memberStuck: false }));

describe('groupByDay', () => {
  it('puts the newest day first and keeps the turns of a day oldest to newest', () => {
    id = 0;
    const events = [ev('prompt', at(2026, 11, 22, 7)), ev('prompt', at(2026, 11, 23, 9)), ev('prompt', at(2026, 11, 23, 15)), ev('prompt', at(2026, 11, 24, 8, 30))];
    const groups = groupsOf(events);
    expect(groups.map(g => g.dayKey)).toEqual(['2026-11-24', '2026-11-23', '2026-11-22']);
    expect(turnsOfDay(groups[1]!).map(t => t.promptNumber)).toEqual([2, 3]);
  });

  it('counts prompts, commands (tool events only) and failures of each day', () => {
    id = 0;
    const events = [
      ev('prompt', at(2026, 11, 23, 9)), ev('tool', at(2026, 11, 23, 9, 1)), ev('tool', at(2026, 11, 23, 9, 2), { ok: false }), ev('tool', at(2026, 11, 23, 9, 3), { kind: 'permission' }),
      ev('prompt', at(2026, 11, 24, 8)), ev('tool', at(2026, 11, 24, 8, 1)),
    ];
    const groups = groupsOf(events);
    expect(groups.map(g => [g.dayKey, g.prompts, g.commands, g.failed])).toEqual([['2026-11-24', 1, 1, 0], ['2026-11-23', 1, 2, 1]]);
    expect(turnsOfDay(groups[1]!)).toHaveLength(1);
  });

  it('keeps a turn that runs past midnight whole, in the day of its prompt', () => {
    id = 0;
    const events = [ev('prompt', at(2026, 11, 23, 23, 58)), ev('tool', at(2026, 11, 24, 0, 3)), ev('prompt', at(2026, 11, 24, 0, 10))];
    const groups = groupsOf(events);
    expect(groups.map(g => [g.dayKey, g.prompts, g.commands])).toEqual([['2026-11-24', 1, 0], ['2026-11-23', 1, 1]]);
  });

  it('gives commands before the first prompt the day of the first of them', () => {
    id = 0;
    const events = [ev('tool', at(2026, 11, 23, 22)), ev('prompt', at(2026, 11, 24, 9))];
    expect(groupsOf(events).map(g => [g.dayKey, g.prompts, g.commands])).toEqual([['2026-11-24', 1, 0], ['2026-11-23', 0, 1]]);
  });

  it('a single day is a single group; no events, no group', () => {
    id = 0;
    expect(groupsOf([ev('prompt', at(2026, 11, 24, 9)), ev('prompt', at(2026, 11, 24, 10))])).toHaveLength(1);
    expect(groupsOf([])).toEqual([]);
  });

  it('splits a day into one block per Claude Code session, oldest first, and the day numbers are the sums of the blocks', () => {
    id = 0;
    const events = [
      ev('prompt', at(2026, 11, 24, 9), { claudeSessionId: 'A' }), ev('prompt', at(2026, 11, 24, 10), { claudeSessionId: 'B' }),
      ev('tool', at(2026, 11, 24, 10, 5), { claudeSessionId: 'A' }), ev('tool', at(2026, 11, 24, 10, 6), { claudeSessionId: 'B', ok: false }), ev('tool', at(2026, 11, 24, 10, 7), { claudeSessionId: 'A' }),
    ];
    const [g] = groupsOf(events);
    expect(g!.blocks.map(b => [b.index, b.prompts, b.commands, b.failed])).toEqual([[1, 1, 2, 0], [2, 1, 1, 1]]);
    expect(g!.prompts).toBe(2);
    expect(g!.commands).toBe(3);
    expect(g!.failed).toBe(1);
    expect(g!.blocks.map(b => [b.firstAt, b.lastAt])).toEqual([[at(2026, 11, 24, 9), at(2026, 11, 24, 10, 7)], [at(2026, 11, 24, 10), at(2026, 11, 24, 10, 6)]]);
    expect(g!.blocks.map(b => b.overlapsWith)).toEqual([[2], [1]]);
  });

  it('overlap needs the hours to meet: sessions one after the other do not overlap', () => {
    id = 0;
    const events = [ev('prompt', at(2026, 11, 24, 8), { claudeSessionId: 'A' }), ev('tool', at(2026, 11, 24, 8, 30), { claudeSessionId: 'A' }), ev('prompt', at(2026, 11, 24, 9), { claudeSessionId: 'B' })];
    expect(groupsOf(events)[0]!.blocks.map(b => b.overlapsWith)).toEqual([[], []]);
  });

  it('endedBy comes from the last /clear or exit of the session over the whole training, also from a later day', () => {
    id = 0;
    const events = [
      ev('prompt', at(2026, 11, 23, 23, 50), { claudeSessionId: 'A' }), ev('tool', at(2026, 11, 24, 0, 5), { claudeSessionId: 'A' }),
      ev('prompt', at(2026, 11, 24, 8), { claudeSessionId: 'A' }), ev('tool', at(2026, 11, 24, 8, 30), { claudeSessionId: 'A', kind: 'session', subtype: 'exit' }),
      ev('prompt', at(2026, 11, 24, 9), { claudeSessionId: 'B' }), ev('tool', at(2026, 11, 24, 9, 1), { claudeSessionId: 'B', kind: 'session', subtype: 'clear' }),
      ev('prompt', at(2026, 11, 24, 10), { claudeSessionId: 'C' }),
    ];
    const [day24, day23] = groupsOf(events);
    expect(day24!.blocks.map(b => [b.index, b.endedBy])).toEqual([[1, 'exit'], [2, 'clear'], [3, null]]);
    // the earlier day's block of a session that ends tomorrow says "tiếp sang", not "chưa kết thúc"
    expect(day23!.blocks[0]).toMatchObject({ index: 1, endedBy: 'exit', continuesTo: day24!.startedAt, lastAt: at(2026, 11, 24, 0, 5) });
    expect(day24!.blocks[0]).toMatchObject({ continuedFrom: day23!.startedAt });
    expect(day24!.blocks[1]!.continuedFrom).toBeUndefined();
    expect(blockEnd(day23!.blocks[0]!)).toBe('next');
    expect(blockEnd(day24!.blocks[0]!)).toBe('exit');
    expect(blockEnd(day24!.blocks[2]!)).toBe('open');
  });
});

describe('dayGroupSpoken', () => {
  it('says the counts, leaves the failures out at 0 and names today', () => {
    expect(dayGroupSpoken('Thứ Ba, 24/11/2026', false, { prompts: 5, commands: 12, failed: 2 })).toBe('Thứ Ba, 24/11/2026, 5 prompt, 12 lệnh, 2 lỗi');
    expect(dayGroupSpoken('Thứ Ba, 24/11/2026', true, { prompts: 1, commands: 0, failed: 0 })).toBe('Thứ Ba, 24/11/2026, hôm nay, 1 prompt, 0 lệnh');
    expect(dayGroupSpoken('Thứ Ba, 24/11/2026', false, { prompts: 2, commands: 1, failed: 0 }, 2)).toBe('Thứ Ba, 24/11/2026, 2 prompt, 1 lệnh, 2 prompt có mục mới');
  });
});

describe('finding where an event or a turn is shown', () => {
  it('answers with the day, block and turn that hold it', () => {
    id = 0;
    const p1 = ev('prompt', at(2026, 11, 23, 23, 58));
    const t1 = ev('tool', at(2026, 11, 24, 0, 3));
    const p2 = ev('prompt', at(2026, 11, 24, 9));
    const events = [p1, t1, p2];
    const places = placesByEvent(events);
    expect(places.get(t1.id)).toMatchObject({ dayKey: '2026-11-23', turnKey: `t${p1.id}` });
    expect(places.get(p2.id)?.dayKey).toBe('2026-11-24');
    expect(places.get(999)).toBeUndefined();
    expect(placeOfTurn(events, `t${p2.id}`)?.dayKey).toBe('2026-11-24');
    expect(placeOfTurn(events, 't999')).toBeNull();
    expect(dayGroupsOf(events).map(g => g.dayKey)).toEqual(['2026-11-24', '2026-11-23']);
  });

  it('the newest prompt is found whichever block holds it', () => {
    id = 0;
    const a = ev('prompt', at(2026, 11, 24, 9), { claudeSessionId: 'A' });
    const b = ev('prompt', at(2026, 11, 24, 9, 5), { claudeSessionId: 'B' });
    const a2 = ev('prompt', at(2026, 11, 24, 9, 10), { claudeSessionId: 'A' });
    expect(newestPromptOf([a, b, a2])?.id).toBe(a2.id);
    expect(newestPromptOf([ev('tool', at(2026, 11, 24, 9))])).toBeNull();
  });

  it('J / K follow the shown order: block by block, not by event id', () => {
    id = 0;
    const open = (extra: Partial<TrainingEventRow>) => ev('tool', at(2026, 11, 24, 9) + id * 1000, { hasOutput: true, ...extra });
    const a1 = ev('prompt', at(2026, 11, 24, 9), { claudeSessionId: 'A' });
    const b1 = ev('prompt', at(2026, 11, 24, 9, 1), { claudeSessionId: 'B' });
    const ta = open({ claudeSessionId: 'A' });
    const tb = open({ claudeSessionId: 'B' });
    const ta2 = open({ claudeSessionId: 'A' });
    const events = [a1, b1, ta, tb, ta2];
    // block A (ta, ta2) is shown above block B (tb)
    expect(stepEvent(events, ta.id, 1)?.id).toBe(ta2.id);
    expect(stepEvent(events, ta2.id, 1)?.id).toBe(tb.id);
    expect(stepEvent(events, tb.id, -1)?.id).toBe(ta2.id);
  });
});

describe('open and folded days', () => {
  it('opens only the newest day the first time days appear, and the only day when there is one', () => {
    expect(reconcileOpenDays({ open: [], known: [] }, ['2026-11-24', '2026-11-23'])).toEqual({ open: ['2026-11-24'], known: ['2026-11-24', '2026-11-23'] });
    expect(reconcileOpenDays({ open: [], known: [] }, ['2026-11-24'])).toEqual({ open: ['2026-11-24'], known: ['2026-11-24'] });
  });
  it('opens a day that appears later and leaves the others as the mentor set them', () => {
    const prev = { open: ['2026-11-23'], known: ['2026-11-24', '2026-11-23'] }; // the mentor folded the newest and opened the older one
    expect(reconcileOpenDays(prev, ['2026-11-25', '2026-11-24', '2026-11-23'])).toEqual({ open: ['2026-11-23', '2026-11-25'], known: ['2026-11-24', '2026-11-23', '2026-11-25'] });
    expect(reconcileOpenDays(prev, ['2026-11-24', '2026-11-23'])).toBe(prev);
  });
  it('withDayOpen adds a day once and ignores null', () => {
    expect(withDayOpen(['a'], 'b')).toEqual(['a', 'b']);
    expect(withDayOpen(['a'], 'a')).toEqual(['a']);
    expect(withDayOpen(['a'], null)).toEqual(['a']);
  });
});

describe('open and folded session blocks', () => {
  const block = (key: string, isDefaultOpen: boolean) => ({ key, isDefaultOpen });
  it('the first time, opens blocks that are unread or have no end signal and folds the rest', () => {
    expect(reconcileOpenBlocks({ open: [], known: [] }, [block('a', false), block('b', true)])).toEqual({ open: ['b'], known: ['a', 'b'] });
  });
  it('a block that appears later opens by itself; the known ones keep the state the mentor left', () => {
    const prev = { open: ['b'], known: ['a', 'b'] };
    expect(reconcileOpenBlocks(prev, [block('a', true), block('b', false), block('c', false)])).toEqual({ open: ['b', 'c'], known: ['a', 'b', 'c'] });
    expect(reconcileOpenBlocks(prev, [block('a', true), block('b', false)])).toBe(prev);
  });
});

describe('dayFlags', () => {
  const build = (stuck: boolean) => {
    id = 0;
    const events = [
      ev('prompt', at(2026, 11, 23, 9)), ev('tool', at(2026, 11, 23, 9, 1), { ok: false, toolTarget: 'npm test' }), ev('tool', at(2026, 11, 23, 9, 2), { ok: false, toolTarget: 'npm test' }), ev('tool', at(2026, 11, 23, 9, 3), { ok: false, toolTarget: 'npm test' }),
      ev('prompt', at(2026, 11, 24, 8)), ev('tool', at(2026, 11, 24, 8, 1)),
    ];
    return { events, groups: groupByDay(buildTimeline(events, { memberStuck: stuck })) };
  };

  it('gives each flag to the days its events fall on, counting only those events', () => {
    const { groups } = build(false);
    const flags = [{ code: 'repeated_failure' as const, ids: [2, 3, 4] }, { code: 'touches_tests' as const, ids: [3, 6] }];
    const by = dayFlags(groups, flags, false);
    expect(by.get('2026-11-23')).toEqual([{ code: 'repeated_failure', count: 3, stuck: false }, { code: 'touches_tests', count: 1, stuck: false }]);
    expect(by.get('2026-11-24')).toEqual([{ code: 'touches_tests', count: 1, stuck: false }]);
  });

  it('shows the stuck chip instead of the repeated-failure flag, on the day of the run that is still going', () => {
    id = 0;
    const fail = (h: number, mi: number) => ev('tool', at(2026, 11, 24, h, mi), { ok: false, toolTarget: 'npm test' });
    const events = [ev('prompt', at(2026, 11, 23, 9)), ev('tool', at(2026, 11, 23, 9, 1)), ev('prompt', at(2026, 11, 24, 8)), fail(8, 1), fail(8, 2), fail(8, 3)];
    const groups = groupByDay(buildTimeline(events, { memberStuck: true }));
    const by = dayFlags(groups, [{ code: 'repeated_failure', ids: [4, 5, 6] }], true);
    expect(by.get('2026-11-24')).toEqual([{ code: 'repeated_failure', count: 3, stuck: true }]);
    expect(by.get('2026-11-23')).toEqual([]);
  });
});
