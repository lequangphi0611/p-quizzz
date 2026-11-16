import { describe, expect, it } from 'vitest';
import { draftOf, planSave } from './grade-draft.js';

const ungraded = { manualScore: null, feedback: null };
const graded = { manualScore: 2.5, feedback: 'ok' };

describe('draftOf', () => {
  it('starts empty for an ungraded paper and filled (decimal comma) for a graded one', () => {
    expect(draftOf(ungraded)).toEqual({ value: '', feedback: '', save: 'unsaved' });
    expect(draftOf(graded)).toEqual({ value: '2,5', feedback: 'ok', save: 'saved' });
  });
});

describe('planSave', () => {
  it('waits for a score, explains a bad one, skips a no-op, otherwise sends', () => {
    expect(planSave(ungraded, 5, '  ', 'note')).toEqual({ kind: 'incomplete' });
    expect(planSave(ungraded, 5, '6', '')).toEqual({ kind: 'invalid', message: 'Điểm phải từ 0 đến 5' });
    expect(planSave(graded, 5, '2,5', 'ok')).toEqual({ kind: 'unchanged', score: 2.5 });
    expect(planSave(graded, 5, '2.5', ' ok ')).toEqual({ kind: 'unchanged', score: 2.5 });
    expect(planSave(graded, 5, '3', 'ok')).toEqual({ kind: 'send', score: 3 });
    expect(planSave(graded, 5, '2.5', 'changed')).toEqual({ kind: 'send', score: 2.5 });
    expect(planSave(ungraded, 5, '0', '')).toEqual({ kind: 'send', score: 0 });
  });
});
