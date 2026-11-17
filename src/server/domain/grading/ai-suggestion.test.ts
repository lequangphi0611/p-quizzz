import { describe, expect, it } from 'vitest';
import { assertCanSuggest, InvalidSuggestionError, normalizeSuggestion, pickAnswersToSuggest, type RawSuggestion } from './ai-suggestion.js';
import { AiUnavailableError, GradingNotOpenError, NoRubricError, NotEssayError, ResultsFinalizedError } from './errors.js';

describe('assertCanSuggest', () => {
  const ok = { questionType: 'essay' as const, explanation: 'rubric', sessionStatus: 'closed' as const, available: true };
  it('passes for a closed essay with a rubric', () => expect(() => assertCanSuggest(ok)).not.toThrow());
  it('rejects in order', () => {
    expect(() => assertCanSuggest({ ...ok, questionType: 'single' })).toThrow(NotEssayError);
    expect(() => assertCanSuggest({ ...ok, sessionStatus: 'running' })).toThrow(GradingNotOpenError);
    expect(() => assertCanSuggest({ ...ok, sessionStatus: 'finalized' })).toThrow(ResultsFinalizedError);
    expect(() => assertCanSuggest({ ...ok, explanation: '  ' })).toThrow(NoRubricError);
    expect(() => assertCanSuggest({ ...ok, available: false })).toThrow(AiUnavailableError);
  });
});

describe('pickAnswersToSuggest', () => {
  const answers = [
    { id: 1, textAnswer: 'a', manualScore: null },
    { id: 2, textAnswer: '  ', manualScore: null },
    { id: 3, textAnswer: 'c', manualScore: 2 },
    { id: 4, textAnswer: 'd', manualScore: null },
    { id: 5, textAnswer: 'e', manualScore: null },
    { id: 6, textAnswer: 'f', manualScore: null },
  ];
  const sug = new Map([
    [4, { status: 'done' as const }],
    [5, { status: 'failed' as const }],
    [6, { status: 'queued' as const }],
  ]);
  it('skips blank, graded and live suggestions; retries failed', () => expect(pickAnswersToSuggest(answers, sug)).toEqual([1, 5]));
  it('limits to the given answers', () => expect(pickAnswersToSuggest(answers, sug, [5, 4])).toEqual([5]));
});

describe('normalizeSuggestion', () => {
  const raw: RawSuggestion = {
    score: 3,
    feedback: ' Thiếu rủi ro. ',
    criteria: [
      { label: 'x', score: 1.5, max: 9, note: 'a' },
      { label: 'y', score: 1.5, max: 9, note: 'b' },
      { label: 'z', score: 0, max: 9, note: 'c' },
    ],
    suspicious: false,
    suspiciousReason: null,
    suspiciousLines: [],
    model: 'm',
  };
  const rubric = [
    { text: 'a', points: 1.5 },
    { text: 'b', points: 1.5 },
    { text: 'c', points: 2 },
  ];

  it('numbers criteria after the rubric and takes their max from it', () => {
    const n = normalizeSuggestion(raw, 5, rubric, 3);
    expect(n.criteria.map(c => [c.label, c.max])).toEqual([['T1', 1.5], ['T2', 1.5], ['T3', 2]]);
    expect(n.feedback).toBe('Thiếu rủi ro.');
  });

  it('rejects scores off the 0.5 grid or out of range, and a wrong criteria count', () => {
    expect(() => normalizeSuggestion({ ...raw, score: 3.3 }, 5, rubric, 3)).toThrow(InvalidSuggestionError);
    expect(() => normalizeSuggestion({ ...raw, score: 6 }, 5, rubric, 3)).toThrow(InvalidSuggestionError);
    expect(() => normalizeSuggestion({ ...raw, criteria: raw.criteria.slice(1) }, 5, rubric, 3)).toThrow(InvalidSuggestionError);
    expect(() => normalizeSuggestion({ ...raw, criteria: [{ label: 'x', score: 3, max: 1, note: '' }] }, 5, null, 3)).toThrow(InvalidSuggestionError);
  });

  it('keeps suspicious lines inside the answer and gives a default reason', () => {
    const n = normalizeSuggestion({ ...raw, suspicious: true, suspiciousReason: '', suspiciousLines: [4, 0, 2, 2, 9] }, 5, rubric, 4);
    expect(n.suspiciousLines).toEqual([2, 4]);
    expect(n.suspiciousReason).toBeTruthy();
  });
});
