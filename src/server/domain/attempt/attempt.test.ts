import { describe, expect, it } from 'vitest';
import type { Exam } from '../exam/exam.js';
import {
  AlreadyAttemptedError, AnswersNotYetVisibleError, AttemptAlreadySubmittedError, AttemptInProgressError, AttemptNotSubmittedError,
  AwaitingApprovalError, InvalidAnswerError, SessionNotRunningError,
} from './errors.js';
import {
  assertCanStart, assertCanWork, assertReviewable, computeProgress, gradeAttempt, maxAutoScore, memberAttemptState, planOrder, reviewState, validateAnswer,
  type Attempt,
} from './attempt.js';

const opt = (id: number, isCorrect: boolean) => ({ id, position: id, text: `o${id}`, isCorrect });
const q = (id: number, type: 'single' | 'multi' | 'essay', points: number, options = [] as ReturnType<typeof opt>[]) => ({ id, position: id, type, prompt: 'p', body: '', points, explanation: null, options });
const exam: Pick<Exam, 'questions'> = { questions: [q(1, 'single', 1, [opt(11, true), opt(12, false)]), q(2, 'multi', 2, [opt(21, true), opt(22, true), opt(23, false)]), q(3, 'essay', 4)] };
const att = (o: Partial<Attempt> = {}): Attempt => ({ id: 1, participantId: 1, attemptNo: 1, questionOrder: [1, 2, 3], optionOrder: {}, startedAt: new Date(0), submittedAt: null, autoScore: null, manualScore: null, editStatus: null, editReason: null, editRequestedAt: null, editResolvedAt: null, ...o });

describe('starting', () => {
  const ok = { sessionStatus: 'running' as const, participantStatus: 'active' as const, existing: [] };
  it('needs a running session, an approved member and no earlier attempt', () => {
    expect(() => assertCanStart(ok)).not.toThrow();
    expect(() => assertCanStart({ ...ok, sessionStatus: 'lobby' })).toThrow(SessionNotRunningError);
    expect(() => assertCanStart({ ...ok, sessionStatus: 'lobby' })).toThrow('Phiên thi chưa bắt đầu hoặc đã đóng');
    expect(() => assertCanStart({ ...ok, participantStatus: 'pending' })).toThrow(AwaitingApprovalError);
    expect(() => assertCanStart({ ...ok, existing: [{ submittedAt: null }] })).toThrow(AttemptInProgressError);
    expect(() => assertCanStart({ ...ok, existing: [{ submittedAt: new Date() }] })).toThrow(AlreadyAttemptedError);
  });

  it('keeps the exam order without shuffle and permutes questions and options with it', () => {
    expect(planOrder(exam, false, () => 0)).toEqual({ questionOrder: [1, 2, 3], optionOrder: { '1': [11, 12], '2': [21, 22, 23], '3': [] } });
    const shuffledPlan = planOrder(exam, true, () => 0);
    expect([...shuffledPlan.questionOrder].sort()).toEqual([1, 2, 3]);
    expect(shuffledPlan.questionOrder).not.toEqual([1, 2, 3]);
    expect([...shuffledPlan.optionOrder['2']!].sort()).toEqual([21, 22, 23]);
  });
});

describe('saving and submitting', () => {
  it('only an unsubmitted attempt in a running session can change', () => {
    expect(() => assertCanWork(att(), 'running')).not.toThrow();
    expect(() => assertCanWork(att({ submittedAt: new Date() }), 'running')).toThrow(AttemptAlreadySubmittedError);
    expect(() => assertCanWork(att(), 'closed')).toThrow(SessionNotRunningError);
  });

  it('validates answers by question type', () => {
    const single = { id: 1, type: 'single' as const, optionIds: [11, 12] };
    const essay = { id: 3, type: 'essay' as const, optionIds: [] };
    expect(validateAnswer(att(), single, 1, { selectedOptionIds: [11, 11] })).toEqual({ selectedOptionIds: [11] });
    expect(validateAnswer(att(), essay, 3, { textAnswer: 'x' })).toEqual({ textAnswer: 'x' });
    const msg = (fn: () => unknown) => { try { fn(); } catch (e) { expect(e).toBeInstanceOf(InvalidAnswerError); return (e as Error).message; } };
    expect(msg(() => validateAnswer(att({ questionOrder: [2] }), single, 1, { selectedOptionIds: [11] }))).toBe('Câu hỏi không thuộc lượt làm bài này');
    expect(msg(() => validateAnswer(att(), essay, 3, { selectedOptionIds: [1] }))).toBe('Câu tự luận cần textAnswer');
    expect(msg(() => validateAnswer(att(), single, 1, { textAnswer: 'x' }))).toBe('Câu trắc nghiệm cần selectedOptionIds');
    expect(msg(() => validateAnswer(att(), single, 1, { selectedOptionIds: [99] }))).toBe('Đáp án không thuộc câu hỏi này');
    expect(msg(() => validateAnswer(att(), single, 1, { selectedOptionIds: [11, 12] }))).toBe('Câu một đáp án chỉ được chọn tối đa 1');
  });

  it('grades every question, blank ones included; essays stay null', () => {
    const r = gradeAttempt(exam, [{ questionId: 1, selectedOptionIds: [11] }, { questionId: 2, selectedOptionIds: [21] }]);
    expect(r.scores).toEqual([{ questionId: 1, autoScore: 1 }, { questionId: 2, autoScore: 0 }, { questionId: 3, autoScore: null }]);
    expect(r.autoScore).toBe(1);
    expect(maxAutoScore(exam)).toBe(3);
  });
});

describe('review and state', () => {
  it('answers appear from closed, for submitted attempts only', () => {
    expect(() => assertReviewable(att({ submittedAt: new Date() }), 'running')).toThrow(AnswersNotYetVisibleError);
    expect(() => assertReviewable(att(), 'closed')).toThrow(AttemptNotSubmittedError);
    expect(() => assertReviewable(att({ submittedAt: new Date() }), 'finalized')).not.toThrow();
  });

  it('reviewState hides a kicked member\'s open attempt once the session is over', () => {
    expect(reviewState([], 'active', 'running')).toBe('none');
    expect(reviewState([att()], 'active', 'running')).toBe('doing');
    expect(reviewState([att()], 'kicked', 'closed')).toBe('none');
    expect(reviewState([att()], 'kicked', 'running')).toBe('doing');
    expect(reviewState([att({ submittedAt: new Date() })], 'active', 'closed')).toBe('submitted');
  });

  it('memberAttemptState: one attempt per session', () => {
    expect(memberAttemptState({ attempts: [], sessionStatus: 'running', participantStatus: 'active' }).canStartNew).toBe(true);
    expect(memberAttemptState({ attempts: [], sessionStatus: 'lobby', participantStatus: 'active' }).canStartNew).toBe(false);
    expect(memberAttemptState({ attempts: [], sessionStatus: 'running', participantStatus: 'pending' }).canStartNew).toBe(false);
    const s = memberAttemptState({ attempts: [att({ submittedAt: new Date(1) })], sessionStatus: 'running', participantStatus: 'active' });
    expect(s).toMatchObject({ current: null, canStartNew: false });
    expect(s.submitted).toHaveLength(1);
  });

  it('computeProgress counts manual points only once finalized', () => {
    const done = att({ submittedAt: new Date(5), autoScore: 2, manualScore: 3 });
    const facts = { kickedIds: new Set<number>(), totalPoints: 7, questionCount: 3, answeredByAttempt: new Map<number, number>() };
    expect(computeProgress([done], { ...facts, sessionStatus: 'closed' }).get(1)).toMatchObject({ state: 'submitted', countedScore: 2, maxScore: 7, submittedAt: 5 });
    expect(computeProgress([done], { ...facts, sessionStatus: 'finalized' }).get(1)!.countedScore).toBe(5);
    expect(computeProgress([att()], { ...facts, sessionStatus: 'running' }).get(1)!.state).toBe('doing');
    expect(computeProgress([att()], { ...facts, kickedIds: new Set([1]), sessionStatus: 'closed' }).get(1)!.state).toBe('none');
  });

  it('computeProgress reports answered questions only for the attempt in progress (PRODUCT.md §7.26)', () => {
    const facts = { kickedIds: new Set<number>(), totalPoints: 7, questionCount: 3, sessionStatus: 'running' as const, answeredByAttempt: new Map([[1, 2]]) };
    expect(computeProgress([att()], facts).get(1)).toMatchObject({ state: 'doing', answered: 2, questionCount: 3 });
    expect(computeProgress([att()], { ...facts, answeredByAttempt: new Map() }).get(1)!.answered).toBe(0);
    expect(computeProgress([att({ submittedAt: new Date(5) })], facts).get(1)).toMatchObject({ state: 'submitted', answered: null, questionCount: 3 });
    expect(computeProgress([att()], { ...facts, kickedIds: new Set([1]), sessionStatus: 'closed' }).get(1)!.answered).toBeNull();
  });
});
