import { describe, expect, it } from 'vitest';
import { draftsFromAnswers, nextSelection, progressOf, withChoice, withText } from './answer-progress.js';

describe('drafts', () => {
  it('builds drafts from saved answers and edits one question without touching the rest', () => {
    const d = draftsFromAnswers([{ questionId: 1, selectedOptionIds: [4], textAnswer: null }, { questionId: 2, selectedOptionIds: null, textAnswer: 'hi' }]);
    expect(d).toEqual({ 1: { selected: [4], text: '' }, 2: { selected: [], text: 'hi' } });
    const e = withText(withChoice(d, 1, [5, 6]), 3, 'new');
    expect(e).toEqual({ 1: { selected: [5, 6], text: '' }, 2: { selected: [], text: 'hi' }, 3: { selected: [], text: 'new' } });
    expect(d[1]).toEqual({ selected: [4], text: '' }); // input untouched
  });
});

describe('nextSelection', () => {
  it('single replaces, multi toggles', () => {
    expect(nextSelection('single', [1], 2)).toEqual([2]);
    expect(nextSelection('multi', [1], 2)).toEqual([1, 2]);
    expect(nextSelection('multi', [1, 2], 1)).toEqual([2]);
  });
});

describe('progressOf', () => {
  it('splits question indexes into answered and unanswered', () => {
    const qs = [{ id: 10 }, { id: 11 }, { id: 12 }];
    expect(progressOf(qs, { 10: { selected: [1], text: '' }, 12: { selected: [], text: ' ' } })).toEqual({ answered: [0], unanswered: [1, 2] });
  });
});
