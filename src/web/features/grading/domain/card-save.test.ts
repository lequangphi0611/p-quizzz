import { describe, expect, it } from 'vitest';
import { planCardSave } from './card-save.js';

const ungraded = { manualScore: null, feedback: null };
const graded = { manualScore: 2.5, feedback: 'ok' };

describe('planCardSave', () => {
  it('does nothing when nothing changed, or when only feedback is typed and no score yet', () => {
    expect(planCardSave(graded, '2,5', 'ok', 5)).toEqual({ kind: 'nothing' });
    expect(planCardSave(ungraded, '', '', 5)).toEqual({ kind: 'nothing' });
    expect(planCardSave(ungraded, '', 'a note', 5)).toEqual({ kind: 'nothing' });
  });
  it('explains an invalid score', () => {
    expect(planCardSave(ungraded, '7', '', 5)).toEqual({ kind: 'invalid', message: 'Điểm phải từ 0 đến 5' });
    expect(planCardSave(ungraded, '1,3', '', 5)).toEqual({ kind: 'invalid', message: 'Điểm phải là bội số của 0,5' });
  });
  it('restores the saved score instead of letting a grade be withdrawn', () => {
    expect(planCardSave(graded, '', 'ok', 5)).toEqual({ kind: 'restore', score: '2,5', message: 'Không bỏ trống được điểm đã chấm. Nhập điểm mới (có thể là 0).' });
  });
  it('sends a changed score or feedback', () => {
    expect(planCardSave(ungraded, '0', '', 5)).toEqual({ kind: 'send', score: 0 });
    expect(planCardSave(graded, '3', 'ok', 5)).toEqual({ kind: 'send', score: 3 });
    expect(planCardSave(graded, '2.5', 'new note', 5)).toEqual({ kind: 'send', score: 2.5 });
  });
});
