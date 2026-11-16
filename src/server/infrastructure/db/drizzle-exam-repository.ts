import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { Exam, NewExam } from '../../domain/exam/exam.js';
import type { ExamRepository, ExamSummary } from '../../application/ports/exam-repository.js';
import type { Db } from './client.js';
import { exams, options, questions } from './schema.js';

/**
 * Runs `fn` against the database. Outside a unit of work this goes through `SqliteDatabase.read`
 * (waits for open units); inside one it runs on the unit's own connection.
 */
export type DbAccess = <T>(fn: (db: Db) => T) => Promise<T>;

const summaryColumns = {
  id: exams.id,
  title: exams.title,
  description: exams.description,
  totalPoints: exams.totalPoints,
  hasEssay: exams.hasEssay,
  createdAt: exams.createdAt,
  questionCount: sql<number>`(select count(*) from questions where questions.exam_id = exams.id)`,
  sessionCount: sql<number>`(select count(*) from sessions where sessions.exam_id = exams.id)`,
};

export class DrizzleExamRepository implements ExamRepository {
  constructor(private readonly access: DbAccess) {}

  list(): Promise<ExamSummary[]> {
    return this.access(db => db.select(summaryColumns).from(exams).orderBy(desc(exams.createdAt), desc(exams.id)).all());
  }

  async findSummary(id: number): Promise<ExamSummary | null> {
    const row = await this.access(db => db.select(summaryColumns).from(exams).where(eq(exams.id, id)).get());
    return row ?? null;
  }

  async findById(id: number): Promise<Exam | null> {
    const row = await this.access(db =>
      db.query.exams
        .findFirst({
          where: eq(exams.id, id),
          with: {
            questions: {
              orderBy: (q, { asc }) => asc(q.position),
              with: { options: { orderBy: (o, { asc }) => asc(o.position) } },
            },
          },
        })
        .sync(),
    );
    return row ?? null;
  }

  async findQuestion(questionId: number) {
    const found = await this.access(db => {
      const q = db.select({ id: questions.id, type: questions.type, points: questions.points }).from(questions).where(eq(questions.id, questionId)).get();
      if (!q) return null;
      return { ...q, optionIds: db.select({ id: options.id }).from(options).where(eq(options.questionId, questionId)).all().map(o => o.id) };
    });
    return found;
  }

  maxAutoScoreOf(examId: number): Promise<number> {
    return this.access(
      db =>
        db
          .select({ s: sql<number>`coalesce(sum(${questions.points}), 0)` })
          .from(questions)
          .where(and(eq(questions.examId, examId), ne(questions.type, 'essay')))
          .get()?.s ?? 0,
    );
  }

  // No transaction of its own: the caller's unit of work makes the whole write atomic.
  add(exam: NewExam): Promise<number> {
    return this.access(db => {
      const { id } = db
        .insert(exams)
        .values({
          title: exam.title,
          description: exam.description,
          sourceMarkdown: exam.sourceMarkdown,
          totalPoints: exam.totalPoints,
          hasEssay: exam.hasEssay,
          createdAt: exam.createdAt,
        })
        .returning({ id: exams.id })
        .get();

      for (const q of exam.questions) {
        const question = db
          .insert(questions)
          .values({
            examId: id,
            position: q.position,
            type: q.type,
            prompt: q.prompt,
            body: q.body,
            points: q.points,
            explanation: q.explanation,
          })
          .returning({ id: questions.id })
          .get();
        if (q.options.length > 0) {
          db.insert(options)
            .values(q.options.map(o => ({ questionId: question.id, position: o.position, text: o.text, isCorrect: o.isCorrect })))
            .run();
        }
      }
      return id;
    });
  }

  async remove(id: number): Promise<void> {
    await this.access(db => db.delete(exams).where(eq(exams.id, id)).run()); // cascades to questions/options
  }
}
