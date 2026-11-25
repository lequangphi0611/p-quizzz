import { beforeEach, describe, expect, it } from 'vitest';
import { autoCompactRepeated } from './auto-compact-repeated.js';
import { ctx, resetEvents, session } from './test-events.js';

beforeEach(resetEvents);

describe('autoCompactRepeated', () => {
  it('goes up after two automatic compactions with no /clear', () => {
    const a = session('compact_auto');
    const b = session('compact_auto');
    expect(autoCompactRepeated([a, b], ctx())).toEqual({ code: 'auto_compact_repeated', eventIds: [a.id, b.id] });
  });
  it('stays down with one, with manual ones, or when /clear came in between', () => {
    expect(autoCompactRepeated([session('compact_auto')], ctx())).toBeNull();
    expect(autoCompactRepeated([session('compact_manual'), session('compact_manual'), session('compact_manual')], ctx())).toBeNull();
    expect(autoCompactRepeated([session('compact_auto'), session('clear'), session('compact_auto')], ctx())).toBeNull();
  });

  it('counts compactions per session: one in each of two sessions is not a repeat, and a /clear in B does not reset A', () => {
    expect(autoCompactRepeated([session('compact_auto', 1, 'A'), session('compact_auto', 2, 'B')], ctx())).toBeNull();
    const a1 = session('compact_auto', 1, 'A');
    const a2 = session('compact_auto', 3, 'A');
    expect(autoCompactRepeated([a1, session('clear', 2, 'B'), a2], ctx())?.eventIds).toEqual([a1.id, a2.id]);
  });
});
