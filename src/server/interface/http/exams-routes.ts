import type { FastifyPluginAsync } from 'fastify';
import {
  EXAM_BODY_LIMIT_BYTES,
  ExamMarkdownBody,
  type CreateExamResponse,
  type ExamDetail,
  type ExamImportErrorResponse,
  type ExamSummary,
} from '../../../shared/api/index.js';
import { ExamNotFoundError } from '../../domain/exam/errors.js';
import type { DeleteExam } from '../../application/use-cases/exams/delete-exam.js';
import { InvalidExamError } from '../../application/use-cases/exams/errors.js';
import type { GetExam } from '../../application/use-cases/exams/get-exam.js';
import type { ImportExam } from '../../application/use-cases/exams/import-exam.js';
import type { ListExams } from '../../application/use-cases/exams/list-exams.js';
import type { PreviewExam } from '../../application/use-cases/exams/preview-exam.js';
import { sendDomainError } from './domain-errors.js';
import { parseId } from './params.js';
import { toExamDetailDto, toExamSummaryDto } from './presenters/exam-presenter.js';

export interface ExamUseCases {
  preview: PreviewExam;
  importExam: ImportExam;
  list: ListExams;
  get: GetExam;
  remove: DeleteExam;
}

// Mentor exam routes. Registered inside the requireMentor scope of /api/admin (see buildApp).
// There is deliberately no update route: exams are immutable once imported.
// A route only parses input, calls one use case and presents the result.
export const examsRoutes = (useCases: ExamUseCases): FastifyPluginAsync =>
  async app => {
    const bodyLimit = EXAM_BODY_LIMIT_BYTES;
    const invalidBody = (message?: string) => ({ error: message ?? 'Dữ liệu không hợp lệ' });

    app.post('/exams/preview', { bodyLimit }, async (req, reply) => {
      const body = ExamMarkdownBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send(invalidBody(body.error.issues[0]?.message));
      return useCases.preview.execute(body.data.markdown);
    });

    app.post('/exams', { bodyLimit }, async (req, reply) => {
      const body = ExamMarkdownBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send(invalidBody(body.error.issues[0]?.message));
      try {
        const { exam, warnings } = await useCases.importExam.execute(body.data.markdown);
        const res: CreateExamResponse = { exam: toExamSummaryDto(exam), warnings };
        return reply.code(201).send(res);
      } catch (err) {
        if (err instanceof InvalidExamError) {
          const res: ExamImportErrorResponse = { error: err.message, errors: err.errors };
          return reply.code(400).send(res);
        }
        return sendDomainError(reply, err);
      }
    });

    app.get('/exams', async (): Promise<ExamSummary[]> => (await useCases.list.execute()).map(toExamSummaryDto));

    app.get<{ Params: { id: string } }>('/exams/:id', async (req, reply): Promise<ExamDetail | undefined> => {
      try {
        const id = parseId(req.params.id);
        if (!id) throw new ExamNotFoundError();
        return toExamDetailDto(await useCases.get.execute(id));
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    app.delete<{ Params: { id: string } }>('/exams/:id', async (req, reply) => {
      try {
        const id = parseId(req.params.id);
        if (!id) throw new ExamNotFoundError();
        await useCases.remove.execute(id);
        return reply.code(204).send();
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });
  };
