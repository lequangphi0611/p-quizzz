import { describe, expect, it } from 'vitest';
import { reasonBoard } from './reason-groups.js';

const opt = (id: number, isCorrect = false) => ({ id, text: `o${id}`, isCorrect, count: 0 });

describe('reasonBoard (S30, PRODUCT.md §7.32e)', () => {
  it('single choice: one group per option in exam order, "no one" groups kept, blanks counted apart', () => {
    const b = reasonBoard({
      type: 'single',
      options: [opt(1), opt(2, true), opt(3), opt(4)],
      reasons: [
        { optionIds: [2], text: 'đúng vì…' },
        { optionIds: [1], text: 'state mới re-render' },
        { optionIds: [1], text: null },
        { optionIds: [2], text: '  ' },
        { optionIds: [3], text: 'useMemo' },
      ],
    });
    expect(b.total).toBe(3);
    expect(b.groups.map(g => [g.letters.join('+'), g.people, g.reasons.length, g.noReason, g.correct])).toEqual([
      ['A', 2, 1, 1, false],
      ['B', 2, 1, 1, true],
      ['C', 1, 1, 0, false],
      ['D', 0, 0, 0, false],
    ]);
    expect(b.groups[0]!.optionTexts).toEqual(['o1']);
  });

  it('multi choice: one group per exact combination, sorted by letters, not by size or correctness', () => {
    const b = reasonBoard({
      type: 'multi',
      options: [opt(10, true), opt(11), opt(12, true), opt(13)],
      reasons: [
        { optionIds: [12], text: 'chỉ C' },
        { optionIds: [12, 10], text: 'A và C' },
        { optionIds: [10, 12], text: 'cũng A và C' },
        { optionIds: [11, 13], text: null },
        { optionIds: [10, 11, 12], text: 'ba cái' },
      ],
    });
    expect(b.groups.map(g => g.letters.join('+'))).toEqual(['A+B+C', 'A+C', 'B+D', 'C']);
    const ac = b.groups.find(g => g.key === '10+12')!;
    expect(ac).toMatchObject({ people: 2, correct: true, reasons: ['A và C', 'cũng A và C'], optionTexts: ['o10', 'o12'] });
    expect(b.groups.find(g => g.key === '11+13')).toMatchObject({ people: 1, noReason: 1, reasons: [] });
    expect(b.total).toBe(4);
  });

  it('no reasons at all', () => {
    expect(reasonBoard({ type: 'multi', options: [opt(1, true), opt(2, true)], reasons: [] })).toEqual({ groups: [], total: 0 });
  });
});
