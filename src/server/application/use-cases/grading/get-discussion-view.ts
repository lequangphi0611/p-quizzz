import type { DiscussionAnswer, DiscussionQuestion, DiscussionReason, DiscussionView } from '../../../../shared/api/index.js';
import { assertDiscussionOpen, compareKeys, shuffleKey } from '../../../domain/grading/grading.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { AttemptReader } from '../../ports/attempt-repository.js';
import type { ExamReader } from '../../ports/exam-repository.js';
import type { SessionRepository } from '../../ports/session-repository.js';
import { loadCountedWork } from './essay-progress.js';

const isBlankText = (t: string | null) => !t || t.trim() === '';

/**
 * Every counted pick on a `{reason}` question with its reason (PRODUCT.md §7.32e): no answer, attempt or participant id,
 * in a stable shuffled order (same keying as the essays), so neither the name nor the join order shows.
 */
function reasonsOf(sessionId: number, questionId: number, rows: { id: number; selectedOptionIds: number[] | null; reasonText: string | null }[]): DiscussionReason[] {
  return rows
    .filter(r => (r.selectedOptionIds?.length ?? 0) > 0)
    .map(r => ({ key: shuffleKey(sessionId, questionId, r.id), reason: { optionIds: [...new Set(r.selectedOptionIds!)].sort((a, b) => a - b), text: isBlankText(r.reasonText) ? null : r.reasonText!.trim() } }))
    .sort((x, y) => compareKeys(x.key, y.key))
    .map(({ reason }) => reason);
}

/**
 * Per-question statistics and anonymous essays for the projector discussion. A read model, built straight into
 * the shared DTO. Essays are labelled "Bài #k" in the same stable shuffled order as the grading screen, never by name.
 */
export class GetDiscussionView {
  constructor(private readonly deps: { attempts: AttemptReader; sessions: Pick<SessionRepository, 'findById'>; exams: ExamReader }) {}

  async execute(sessionId: number): Promise<DiscussionView> {
    const session = await this.deps.sessions.findById(sessionId);
    if (!session) throw new SessionNotFoundError();
    assertDiscussionOpen(session.status);

    const { exam, counted, answers } = await loadCountedWork(this.deps, sessionId, session.examId);
    const submitted = counted.size;

    const questions: DiscussionQuestion[] = exam.questions.map(q => {
      const mine = answers.filter(r => r.questionId === q.id);
      // A counted attempt always has a row per question (submit fills them); a missing row still counts as blank.
      const missing = submitted - mine.length;
      const base = { id: q.id, position: q.position, type: q.type, prompt: q.prompt, body: q.body, points: q.points, explanation: q.explanation, requireReason: q.requireReason };
      if (q.type === 'essay') {
        const list: DiscussionAnswer[] = mine
          .map(r => ({ key: shuffleKey(sessionId, q.id, r.id), a: { answerId: r.id, label: '', textAnswer: r.textAnswer, manualScore: r.manualScore, feedback: r.feedback } }))
          .sort((x, y) => compareKeys(x.key, y.key))
          .map(({ a }, i) => ({ ...a, label: `Bài #${i + 1}` }));
        return { ...base, options: [], correctCount: 0, blankCount: missing + mine.filter(r => isBlankText(r.textAnswer)).length, answers: list, reasons: [] };
      }
      const counts = new Map<number, number>();
      for (const r of mine) for (const id of new Set(r.selectedOptionIds ?? [])) counts.set(id, (counts.get(id) ?? 0) + 1);
      return {
        ...base,
        options: q.options.map(o => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, count: counts.get(o.id) ?? 0 })),
        correctCount: mine.filter(r => r.autoScore !== null && r.autoScore >= q.points).length,
        blankCount: missing + mine.filter(r => !r.selectedOptionIds || r.selectedOptionIds.length === 0).length,
        answers: [],
        reasons: q.requireReason ? reasonsOf(sessionId, q.id, mine) : [],
      };
    });

    const essays = questions.flatMap(q => q.answers);
    return { sessionId, examTitle: exam.title, status: session.status, submitted, graded: essays.filter(a => a.manualScore !== null).length, total: essays.length, questions };
  }
}
