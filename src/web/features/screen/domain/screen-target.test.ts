import { describe, expect, it } from 'vitest';
import type { ScreenSessionItem } from '../../../../shared/api/index.js';
import { decideScreenTarget } from './screen-target.js';

const item = (id: number, status: ScreenSessionItem['status'] = 'lobby'): ScreenSessionItem => ({ id, name: `S${id}`, slot: id, title: 'Đề', status });

describe('decideScreenTarget', () => {
  it('one open session: follow it', () => expect(decideScreenTarget({ open: [item(4)], latestEnded: null })).toEqual({ kind: 'go', sessionId: 4 }));
  it('several open: the mentor picks', () => {
    const t = decideScreenTarget({ open: [item(1), item(2)], latestEnded: null });
    expect(t).toMatchObject({ kind: 'choose' });
    expect(t.kind === 'choose' && t.sessions.map(s => s.id)).toEqual([1, 2]);
  });
  it('none open: the one that ended last, else wait', () => {
    expect(decideScreenTarget({ open: [], latestEnded: item(9, 'closed') })).toEqual({ kind: 'go', sessionId: 9 });
    expect(decideScreenTarget({ open: [], latestEnded: null })).toEqual({ kind: 'none' });
  });
});
