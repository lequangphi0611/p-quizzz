import { describe, expect, it } from 'vitest';
import { assertCanShare, isShared, sharedQuestions, ShareNotAllowedError, tokensMatch } from './sharing.js';

const q = (id: number, type: 'single' | 'multi' | 'essay', optionIds: number[]) => ({
  id, position: id, type, prompt: `Q${id}`, body: '', points: 1, explanation: 'why', requireReason: false,
  options: optionIds.map((o, i) => ({ id: o, position: i, text: `o${o}`, isCorrect: i === 0 })),
});

describe('sharing rules', () => {
  it('only an ended session can be shared', () => {
    for (const s of ['draft', 'lobby', 'running'] as const) expect(() => assertCanShare(s)).toThrow(ShareNotAllowedError);
    for (const s of ['closed', 'finalized'] as const) expect(() => assertCanShare(s)).not.toThrow();
  });

  it('is shared only with a time and an ended status', () => {
    expect(isShared({ status: 'closed', sharedAt: new Date() })).toBe(true);
    expect(isShared({ status: 'closed', sharedAt: null })).toBe(false);
    expect(isShared({ status: 'running', sharedAt: new Date() })).toBe(false);
  });

  it('compares tokens exactly', () => {
    expect(tokensMatch('abc', 'abc')).toBe(true);
    expect(tokensMatch('abd', 'abc')).toBe(false);
    expect(tokensMatch('ab', 'abc')).toBe(false);
    expect(tokensMatch('abcd', 'abc')).toBe(false);
    expect(tokensMatch('', 'abc')).toBe(false);
  });

  it('counts picks per option and blanks; essays and empty sessions have no distribution', () => {
    const exam = { questions: [q(1, 'single', [10, 11]), q(2, 'multi', [20, 21, 22]), q(3, 'essay', [])] };
    const answers = [
      { questionId: 1, selectedOptionIds: [10] },
      { questionId: 1, selectedOptionIds: [11] },
      { questionId: 1, selectedOptionIds: [] },
      { questionId: 2, selectedOptionIds: [20, 21, 21] },
      { questionId: 2, selectedOptionIds: [20, 99] }, // an id not on the question is ignored
    ];
    const [single, multi, essay] = sharedQuestions(exam, answers, 3);
    expect(single!.distribution).toEqual({ counts: { 10: 1, 11: 1 }, blank: 1 });
    expect(multi!.distribution).toEqual({ counts: { 20: 2, 21: 1, 22: 0 }, blank: 1 }); // the third person's row is missing
    expect(essay!.distribution).toBeNull();
    expect(sharedQuestions(exam, [], 0).every(x => x.distribution === null)).toBe(true);
  });

  it('carries only question data and counts', () => {
    const [one] = sharedQuestions({ questions: [q(1, 'single', [10])] }, [], 1);
    expect(Object.keys(one!).sort()).toEqual(['body', 'distribution', 'explanation', 'id', 'options', 'points', 'position', 'prompt', 'type']);
    expect(Object.keys(one!.options[0]!).sort()).toEqual(['id', 'isCorrect', 'position', 'text']);
  });
});
