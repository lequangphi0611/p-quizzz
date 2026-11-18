import { describe, expect, it } from 'vitest';
import { hasRubric, parseRubric } from './rubric.js';

describe('parseRubric', () => {
  const text = [
    'Merge cho nhánh dùng chung; rebase để dọn nhánh cá nhân.',
    '',
    '- Merge giữ nguyên lịch sử, phù hợp nhánh dùng chung (1,5đ)',
    '- Rebase làm lịch sử thẳng (1.5 điểm)',
    '* Rủi ro: viết lại lịch sử đã push (2đ).',
  ].join('\n');

  it('splits scored list items from the model answer', () => {
    expect(parseRubric(text, 5)).toEqual({
      criteria: [
        { text: 'Merge giữ nguyên lịch sử, phù hợp nhánh dùng chung', points: 1.5 },
        { text: 'Rebase làm lịch sử thẳng', points: 1.5 },
        { text: 'Rủi ro: viết lại lịch sử đã push', points: 2 },
      ],
      model: 'Merge cho nhánh dùng chung; rebase để dọn nhánh cá nhân.',
    });
  });

  it('gives up when the criteria do not add up to the question points', () => {
    expect(parseRubric(text, 6)).toBeNull();
  });

  it('gives up on a free-text rubric', () => {
    expect(parseRubric('Nêu được merge và rebase, mỗi ý 2 điểm.', 4)).toBeNull();
  });

  it('accepts numbered lists', () => {
    expect(parseRubric('1. Ý một (1đ)\n2) Ý hai (2 d)', 3)?.criteria.map(c => c.points)).toEqual([1, 2]);
  });

  it('has no rubric without text', () => {
    expect(parseRubric(null, 3)).toBeNull();
    expect(hasRubric('  \n ')).toBe(false);
    expect(hasRubric('x')).toBe(true);
  });
});
