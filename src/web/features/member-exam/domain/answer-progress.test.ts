import { describe, expect, it } from 'vitest';
import { draftsFromAnswers, nextSelection, progressOf, withChoice, withText } from './answer-progress.js';

describe('drafts', () => {
  it('builds drafts from saved answers and edits one question without touching the rest', () => {
    const d = draftsFromAnswers([{ questionId: 1, selectedOptionIds: [4], textAnswer: null }, { questionId: 2, selectedOptionIds: null, textAnswer: 'hi' }]);
    expect(d).toEqual({ 1: { selected: [4], text: '', reason: '' }, 2: { selected: [], text: 'hi', reason: '' } });
    const e = withText(withChoice(d, 1, [5, 6]), 3, 'new');
    expect(e).toEqual({ 1: { selected: [5, 6], text: '', reason: '' }, 2: { selected: [], text: 'hi', reason: '' }, 3: { selected: [], text: 'new', reason: '' } });
    expect(d[1]).toEqual({ selected: [4], text: '', reason: '' }); // input untouched
  });
});

describe('nextSelection', () => {
  it('single replaces, multi toggles', () => {
    expect(nextSelection('single', [1], 2)).toEqual([2]);
    expect(nextSelection('multi', [1], 2)).toEqual([1, 2]);
    expect(nextSelection('multi', [1, 2], 1)).toEqual([2]);
  });
});

describe('draftsFromAnswers', () => {
  it('keeps the saved reason', () => {
    expect(draftsFromAnswers([{ questionId: 1, selectedOptionIds: [2], textAnswer: null, reasonText: 'vì' }])).toEqual({ 1: { selected: [2], text: '', reason: 'vì' } });
  });
});

describe('progressOf', () => {
  it('splits question indexes into answered and unanswered', () => {
    const qs = [{ id: 10 }, { id: 11 }, { id: 12 }];
    expect(progressOf(qs, { 10: { selected: [1], text: '', reason: '' }, 12: { selected: [], text: ' ', reason: '' } })).toEqual({ answered: [0], unanswered: [1, 2], needsReason: [] });
  });

  it('lists {reason} questions picked without a reason; a blank one needs none (PRODUCT.md §7.32b)', () => {
    const qs = [{ id: 10, requireReason: true }, { id: 11, requireReason: true }, { id: 12, requireReason: true }, { id: 13 }];
    const drafts = { 10: { selected: [1], text: '', reason: '  ' }, 11: { selected: [2], text: '', reason: 'vì vậy' }, 13: { selected: [3], text: '', reason: '' } };
    expect(progressOf(qs, drafts)).toEqual({ answered: [0, 1, 3], unanswered: [2], needsReason: [0] });
  });
});
