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
});
