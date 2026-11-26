import { describe, expect, it } from 'vitest';
import type { AiSuggestionDto, GradingAnswer } from '../../../../shared/api/index.js';
import { aiCounts, finalizeBlockers, gradeSource, needsPolling, startsCollapsed, stripMode, visibleAnswers } from './ai-ui.js';

const sug = (o: Partial<AiSuggestionDto> = {}): AiSuggestionDto => ({ status: 'done', score: 3, feedback: 'f', criteria: [], suspicious: false, suspiciousReason: null, suspiciousLines: [], error: null, used: null, ...o });
const ans = (answerId: number, o: Partial<GradingAnswer> = {}): GradingAnswer => ({ answerId, participantId: answerId, displayName: `N${answerId}`, textAnswer: 'x', manualScore: null, feedback: null, aiSuggestion: null, ...o });

const answers = [
  ans(1, { aiSuggestion: sug() }),
  ans(2, { aiSuggestion: sug({ suspicious: true, suspiciousLines: [2] }) }),
  ans(3, { aiSuggestion: sug({ status: 'failed', error: 'Quá thời gian' }) }),
  ans(4, { aiSuggestion: sug(), manualScore: 3 }),
  ans(5),
  ans(6, { textAnswer: '  ' }),
];

describe('aiCounts', () => {
  it('counts only the mentor grades as graded; suggestions wait for confirmation', () => {
    expect(aiCounts({ answers })).toMatchObject({ total: 6, graded: 1, blank: 1, blankUngraded: 1, sent: 4, ok: 3, err: 1, sugPending: 2, flagPending: 1, errPending: 1, toSend: 1, running: false });
  });
});

describe('stripMode', () => {
  const view = { status: 'closed' as const, aiGrader: { available: true } };
  const q = { hasRubric: true };
  it('follows the design states', () => {
    expect(stripMode({ ...view, aiGrader: { available: false } }, q, aiCounts({ answers }))).toBe('off');
    expect(stripMode({ ...view, status: 'finalized' }, q, aiCounts({ answers }))).toBe('final');
    expect(stripMode(view, { hasRubric: false }, aiCounts({ answers }))).toBe('norubric');
    expect(stripMode(view, q, aiCounts({ answers: [ans(1, { aiSuggestion: sug({ status: 'queued' }) })] }))).toBe('running');
    expect(stripMode(view, q, aiCounts({ answers }))).toBe('done');
    expect(stripMode(view, q, aiCounts({ answers: [ans(1)] }))).toBe('ready');
    expect(stripMode(view, q, aiCounts({ answers: [ans(1, { manualScore: 1 })] }))).toBe('allgraded');
  });
});

describe('visibleAnswers', () => {
  it('pins ungraded suspicious answers first and keeps the shuffled numbers', () => {
    expect(visibleAnswers(answers, 'all').map(r => [r.answer.answerId, r.index, r.pinned])[0]).toEqual([2, 1, true]);
    expect(visibleAnswers(answers, 'todo').map(r => r.answer.answerId)).toEqual([2, 1]);
    expect(visibleAnswers(answers, 'err').map(r => r.index)).toEqual([2]);
  });
  it('keeps a suspicious answer graded in this view at the top, without the pin, so its "Hoàn tác" does not jump away', () => {
    const graded = answers.map(a => (a.answerId === 2 ? { ...a, manualScore: 3 } : a));
    expect(visibleAnswers(graded, 'all').map(r => r.answer.answerId)[0]).toBe(1); // left the view: back in the shuffled order
    expect(visibleAnswers(graded, 'all', new Set([2])).map(r => [r.answer.answerId, r.pinned])[0]).toEqual([2, false]);
  });
});

describe('helpers', () => {
  it('polls while something waits', () => {
    expect(needsPolling({ questions: [{ answers } as never] })).toBe(false);
    expect(needsPolling({ questions: [{ answers: [ans(1, { aiSuggestion: sug({ status: 'running' }) })] } as never] })).toBe(true);
  });
  it('explains what blocks finalize', () => {
    expect(finalizeBlockers({ questions: [{ answers } as never] })).toEqual({ left: 5, suggestedOnly: 2 });
  });
  it('never collapses a suspicious answer', () => {
    const long = 'a\n'.repeat(10);
    expect(startsCollapsed(ans(1, { textAnswer: long }))).toBe(true);
    expect(startsCollapsed(ans(1, { textAnswer: long, aiSuggestion: sug({ suspicious: true }) }))).toBe(false);
  });
  it('names where a grade came from', () => {
    expect(gradeSource(ans(1, { manualScore: 3, aiSuggestion: sug({ used: 'accepted' }) }))).toBe('ai');
    expect(gradeSource(ans(1, { manualScore: 3, aiSuggestion: sug({ used: 'edited' }) }))).toBe('ai-edit');
    expect(gradeSource(ans(1, { aiSuggestion: sug({ used: 'accepted' }) }))).toBeNull();
  });
});
