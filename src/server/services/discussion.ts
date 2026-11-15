import { eq, inArray } from 'drizzle-orm';
import type { DiscussionAnswer, DiscussionQuestion, DiscussionView } from '../../shared/api/index.js';
import type { Db } from '../db/client.js';
import { answers, exams, options, questions } from '../db/schema.js';
import { ServiceError } from './errors.js';
import { countedAttempts, sessionInfo, shuffleKey } from './grading.js';

const isBlankText = (t: string | null) => !t || t.trim() === '';

export function getDiscussionView(db: Db, sessionId: number): DiscussionView {
  const info = sessionInfo(db, sessionId);
  if (info.status !== 'closed' && info.status !== 'finalized') throw new ServiceError(409, 'Chỉ thảo luận được sau khi đóng phiên');

  const attemptIds = [...countedAttempts(db, sessionId).values()].map(a => a.id);
  const qs = db.select().from(questions).where(eq(questions.examId, info.examId)).orderBy(questions.position).all();
  const opts = qs.length === 0 ? [] : db.select().from(options).where(inArray(options.questionId, qs.map(q => q.id))).orderBy(options.position).all();
  const rows = attemptIds.length === 0 ? [] : db.select().from(answers).where(inArray(answers.attemptId, attemptIds)).all();

  const out: DiscussionQuestion[] = qs.map(q => {
    const mine = rows.filter(r => r.questionId === q.id);
    // A counted attempt always has a row per question (submit fills them); a missing row still counts as blank.
    const missing = attemptIds.length - mine.length;
    if (q.type === 'essay') {
      const list: DiscussionAnswer[] = mine
        .map(r => ({ key: shuffleKey(sessionId, q.id, r.id), a: { answerId: r.id, label: '', textAnswer: r.textAnswer, manualScore: r.manualScore, feedback: r.feedback } }))
        .sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0))
        .map(({ a }, i) => ({ ...a, label: `Bài #${i + 1}` }));
      return {
        id: q.id, position: q.position, type: q.type, prompt: q.prompt, body: q.body, points: q.points, explanation: q.explanation,
        options: [], correctCount: 0, blankCount: missing + mine.filter(r => isBlankText(r.textAnswer)).length, answers: list,
      };
    }
    const counts = new Map<number, number>();
    for (const r of mine) for (const id of new Set(r.selectedOptionIds ?? [])) counts.set(id, (counts.get(id) ?? 0) + 1);
    return {
      id: q.id, position: q.position, type: q.type, prompt: q.prompt, body: q.body, points: q.points, explanation: q.explanation,
      options: opts.filter(o => o.questionId === q.id).map(o => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, count: counts.get(o.id) ?? 0 })),
      correctCount: mine.filter(r => r.autoScore !== null && r.autoScore >= q.points).length,
      blankCount: missing + mine.filter(r => !r.selectedOptionIds || r.selectedOptionIds.length === 0).length,
      answers: [],
    };
  });

  const essays = out.flatMap(q => q.answers);
  const examTitle = db.select({ title: exams.title }).from(exams).where(eq(exams.id, info.examId)).get()?.title ?? '';
  return { sessionId, examTitle, status: info.status, submitted: attemptIds.length, graded: essays.filter(a => a.manualScore !== null).length, total: essays.length, questions: out };
}
