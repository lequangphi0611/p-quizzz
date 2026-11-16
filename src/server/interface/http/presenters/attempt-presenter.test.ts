import { describe, expect, it } from 'vitest';
import type { ReviewData } from '../../../application/use-cases/attempts/attempt-data.js';
import { toAttemptViewDto, toReviewViewDto } from './attempt-presenter.js';

const data: ReviewData = {
  sessionStatus: 'running',
  attempt: { id: 1, participantId: 1, attemptNo: 1, questionOrder: [2, 1], optionOrder: { '1': [12, 11], '2': [] }, startedAt: new Date(1), submittedAt: null, autoScore: 1, manualScore: null, editStatus: null, editReason: null, editRequestedAt: null, editResolvedAt: null },
  answers: [{ id: 1, attemptId: 1, questionId: 1, selectedOptionIds: [11], textAnswer: null, autoScore: 1, manualScore: null, feedback: 'secret feedback', gradedAt: null }],
  exam: {
    id: 1, title: 'T', description: null, sourceMarkdown: 'SECRET SOURCE', totalPoints: 5, hasEssay: true, createdAt: new Date(0),
    questions: [
      { id: 1, position: 1, type: 'single', prompt: 'S', body: 'b', points: 1, explanation: 'SECRET WHY', options: [{ id: 11, position: 1, text: 'a', isCorrect: true }, { id: 12, position: 2, text: 'b', isCorrect: false }] },
      { id: 2, position: 2, type: 'essay', prompt: 'E', body: '', points: 4, explanation: 'SECRET RUBRIC', options: [] },
    ],
  },
};

describe('member attempt view (no answer key while the session runs)', () => {
  it('has the attempt order and the member\'s own answers, and nothing from the key', () => {
    const dto = toAttemptViewDto(data);
    expect(dto.questions.map(q => q.id)).toEqual([2, 1]);
    expect(dto.questions[1]!.options).toEqual([{ id: 12, text: 'b' }, { id: 11, text: 'a' }]);
    const json = JSON.stringify(dto);
    for (const leak of ['isCorrect', 'explanation', 'SECRET', 'feedback', 'autoScore', 'score']) expect(json, leak).not.toContain(leak);
  });

  it('the review DTO is the one that carries the key', () => {
    const json = JSON.stringify(toReviewViewDto({ ...data, sessionStatus: 'closed', attempt: { ...data.attempt, submittedAt: new Date(2) } }));
    expect(json).toContain('isCorrect');
    expect(json).toContain('SECRET WHY');
    expect(json).not.toContain('SECRET SOURCE'); // the exam's source file is never part of a member DTO
  });
});
