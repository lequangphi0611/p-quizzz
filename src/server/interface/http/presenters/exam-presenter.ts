import type { ExamDetail, ExamSummary as ExamSummaryDto } from '../../../../shared/api/index.js';
import type { ExamSummary } from '../../../application/ports/exam-repository.js';
import type { ExamDetail as ExamDetailResult } from '../../../application/use-cases/exams/get-exam.js';

export const toExamSummaryDto = (s: ExamSummary): ExamSummaryDto => ({
  id: s.id,
  title: s.title,
  description: s.description,
  questionCount: s.questionCount,
  totalPoints: s.totalPoints,
  hasEssay: s.hasEssay,
  createdAt: s.createdAt.getTime(),
  sessionCount: s.sessionCount,
});

export const toExamDetailDto = ({ summary, exam }: ExamDetailResult): ExamDetail => ({
  ...toExamSummaryDto(summary),
  sourceMarkdown: exam.sourceMarkdown,
  questions: exam.questions.map(q => ({
    id: q.id,
    position: q.position,
    type: q.type,
    prompt: q.prompt,
    body: q.body,
    points: q.points,
    explanation: q.explanation,
    options: q.options.map(o => ({ id: o.id, position: o.position, text: o.text, isCorrect: o.isCorrect })),
  })),
});
