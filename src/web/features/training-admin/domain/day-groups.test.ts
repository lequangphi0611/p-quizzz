import { describe, expect, it } from 'vitest';
import type { TrainingEventRow } from '../../../../shared/api/index.js';
import { dayGroupSummary, dayGroupsOf, dayKeyOfEvent, dayKeyOfTurn, groupByDay, reconcileOpenDays, withDayOpen } from './day-groups.js';
import { buildTimeline } from './timeline.js';

// Local-time moments, so the tests do not depend on the machine's time zone.
const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

let id = 0;
const ev = (kind: 'prompt' | 'tool', receivedAt: number, extra: Partial<TrainingEventRow> = {}): TrainingEventRow =>
  ({ id: ++id, kind, receivedAt, claudeSessionId: 's1', hasOutput: false, hasChange: false, marked: false, ...(kind === 'tool' ? { ok: true } : {}), ...extra });
const groupsOf = (events: TrainingEventRow[]) => groupByDay(buildTimeline(events, { memberStuck: false }));

describe('groupByDay', () => {
  it('puts the newest day first and keeps the turns of a day oldest to newest', () => {
    id = 0;
    const events = [ev('prompt', at(2026, 11, 22, 7)), ev('prompt', at(2026, 11, 23, 9)), ev('prompt', at(2026, 11, 23, 15)), ev('prompt', at(2026, 11, 24, 8, 30))];
    const groups = groupsOf(events);
    expect(groups.map(g => g.dayKey)).toEqual(['2026-11-24', '2026-11-23', '2026-11-22']);
    expect(groups[1]!.items.map(i => (i.kind === 'turn' ? i.promptNumber : null))).toEqual([2, 3]);
  });

  it('counts prompts, commands (tool events only) and failures of each day', () => {
    id = 0;
    const events = [
      ev('prompt', at(2026, 11, 23, 9)), ev('tool', at(2026, 11, 23, 9, 1)), ev('tool', at(2026, 11, 23, 9, 2), { ok: false }), ev('tool', at(2026, 11, 23, 9, 3), { kind: 'permission' }),
      ev('prompt', at(2026, 11, 24, 8)), ev('tool', at(2026, 11, 24, 8, 1)),
    ];
    const groups = groupsOf(events);
    expect(groups.map(g => [g.dayKey, g.prompts, g.commands, g.failed])).toEqual([['2026-11-24', 1, 1, 0], ['2026-11-23', 1, 2, 1]]);
    expect(groups[1]!.items.filter(i => i.kind === 'turn')).toHaveLength(1);
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

  it('a Claude Code session that spans two days has its divider only in the day where it opens', () => {
    id = 0;
    const events = [
      ev('prompt', at(2026, 11, 23, 9), { claudeSessionId: 'A' }), ev('prompt', at(2026, 11, 23, 10), { claudeSessionId: 'B' }),
      ev('prompt', at(2026, 11, 24, 9), { claudeSessionId: 'B' }), ev('prompt', at(2026, 11, 24, 10), { claudeSessionId: 'A' }),
    ];
    const kinds = groupsOf(events).map(g => g.items.map(i => i.kind));
    expect(kinds).toEqual([['turn', 'session', 'turn'], ['session', 'turn', 'session', 'turn']]);
  });
});

describe('dayGroupSummary', () => {
  it('writes the label with the counts, leaving out the failures at 0', () => {
    expect(dayGroupSummary('Thứ Ba, 24/11/2026', { prompts: 5, commands: 12, failed: 2 })).toBe('Thứ Ba, 24/11/2026 · 5 prompt · 12 lệnh · 2 lỗi');
    expect(dayGroupSummary('Thứ Ba, 24/11/2026', { prompts: 1, commands: 0, failed: 0 })).toBe('Thứ Ba, 24/11/2026 · 1 prompt · 0 lệnh');
  });
});

describe('finding the day of an event or a turn', () => {
  it('answers with the day of the turn that holds it', () => {
    id = 0;
    const p1 = ev('prompt', at(2026, 11, 23, 23, 58));
    const t1 = ev('tool', at(2026, 11, 24, 0, 3));
    const p2 = ev('prompt', at(2026, 11, 24, 9));
    const events = [p1, t1, p2];
    expect(dayKeyOfEvent(events, t1.id)).toBe('2026-11-23');
    expect(dayKeyOfEvent(events, p2.id)).toBe('2026-11-24');
    expect(dayKeyOfEvent(events, 999)).toBeNull();
    expect(dayKeyOfTurn(events, `t${p2.id}`)).toBe('2026-11-24');
    expect(dayKeyOfTurn(events, 't999')).toBeNull();
    expect(dayGroupsOf(events).map(g => g.dayKey)).toEqual(['2026-11-24', '2026-11-23']);
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
