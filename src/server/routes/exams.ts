import { desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  EXAM_BODY_LIMIT_BYTES,
  ExamMarkdownBody,
  type CreateExamResponse,
  type ExamDetail,
  type ExamImportErrorResponse,
  type ExamSummary,
} from '../../shared/api/index.js';
import { parseExam, type ParsedExam } from '../../shared/exam-format/index.js';
import type { Db } from '../db/client.js';
import { exams, options, questions } from '../db/schema.js';
import { fail, parseId } from './util.js';

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

type SummaryRow = {
  id: number;
  title: string;
  description: string | null;
  totalPoints: number;
  hasEssay: boolean;
  createdAt: Date;
  questionCount: number;
  sessionCount: number;
};

const toSummary = (r: SummaryRow): ExamSummary => ({ ...r, createdAt: r.createdAt.getTime() });

export function getExamSummary(db: Db, id: number): ExamSummary | null {
  const row = db.select(summaryColumns).from(exams).where(eq(exams.id, id)).get();
  return row ? toSummary(row) : null;
}

// Writes exam + questions + options atomically (better-sqlite3 transactions are synchronous).
// Any failure rolls everything back, so a half-imported exam is never left behind.
export function createExam(db: Db, parsed: ParsedExam, sourceMarkdown: string): number {
  return db.transaction(tx => {
    const exam = tx
      .insert(exams)
      .values({
        title: parsed.title,
        description: parsed.description,
        sourceMarkdown,
        totalPoints: parsed.totalPoints,
        hasEssay: parsed.hasEssay,
        createdAt: new Date(),
      })
      .returning({ id: exams.id })
      .get();

    parsed.questions.forEach((q, qi) => {
      const question = tx
        .insert(questions)
        .values({
          examId: exam.id,
          position: qi + 1,
          type: q.type,
          prompt: q.prompt,
          body: q.body,
          points: q.points,
          explanation: q.explanation,
        })
        .returning({ id: questions.id })
        .get();
      if (q.options.length > 0) {
        tx.insert(options)
          .values(q.options.map((o, oi) => ({ questionId: question.id, position: oi + 1, text: o.text, isCorrect: o.correct })))
          .run();
      }
    });
    return exam.id;
  });
}

// Mentor exam routes. Registered inside the requireMentor scope of /api/admin (see buildApp).
// There is deliberately no update route: exams are immutable once imported.
export async function examsRoutes(app: FastifyInstance) {
  const bodyLimit = EXAM_BODY_LIMIT_BYTES;
  const notFound = { error: 'Không tìm thấy đề' };

  app.post('/exams/preview', { bodyLimit }, async (req, reply) => {
    const body = ExamMarkdownBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
    return parseExam(body.data.markdown);
  });

  app.post('/exams', { bodyLimit }, async (req, reply) => {
    const body = ExamMarkdownBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });

    // Always re-parse server-side; never trust a client-supplied parse result.
    const result = parseExam(body.data.markdown);
    if (!result.exam || result.errors.length > 0) {
      const res: ExamImportErrorResponse = { error: 'Đề có lỗi, chưa import được', errors: result.errors };
      return reply.code(400).send(res);
    }

    const id = createExam(app.db, result.exam, body.data.markdown);
    const res: CreateExamResponse = { exam: getExamSummary(app.db, id)!, warnings: result.warnings };
    return reply.code(201).send(res);
  });

  app.get('/exams', async (): Promise<ExamSummary[]> =>
    app.db.select(summaryColumns).from(exams).orderBy(desc(exams.createdAt), desc(exams.id)).all().map(toSummary),
  );

  app.get<{ Params: { id: string } }>('/exams/:id', async (req, reply): Promise<ExamDetail | undefined> => {
    const id = parseId(req.params.id);
    const summary = id ? getExamSummary(app.db, id) : null;
    if (!id || !summary) return reply.code(404).send(notFound);

    const exam = app.db.query.exams
      .findFirst({
        where: eq(exams.id, id),
        with: {
          questions: {
            orderBy: (q, { asc }) => asc(q.position),
            with: { options: { orderBy: (o, { asc }) => asc(o.position) } },
          },
        },
      })
      .sync()!;

    return {
      ...summary,
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
    };
  });

  app.delete<{ Params: { id: string } }>('/exams/:id', async (req, reply) => {
    const id = parseId(req.params.id);
    const summary = id ? getExamSummary(app.db, id) : null;
    if (!id || !summary) return reply.code(404).send(notFound);
    if (summary.sessionCount > 0) return reply.code(409).send({ error: 'Đề đã được dùng cho phiên thi, không xoá được' });
    app.db.delete(exams).where(eq(exams.id, id)).run(); // cascades to questions/options
    return reply.code(204).send();
  });
}
