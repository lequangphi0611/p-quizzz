import { parseExam, type ExamIssue } from '../../../../shared/exam-format/index.js';
import { newExam } from '../../../domain/exam/exam.js';
import type { ExamReader, ExamSummary, ExamUnitContext } from '../../ports/exam-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { InvalidExamError } from './errors.js';

export interface ImportExamResult {
  exam: ExamSummary;
  warnings: ExamIssue[];
}

/** Imports an exam from Markdown. Always parses again here: a client-supplied parse result is never trusted. */
export class ImportExam {
  constructor(
    private readonly deps: {
      unitOfWork: UnitOfWork<ExamUnitContext>;
      exams: ExamReader;
      /** Replaced by the shared `Clock` port in P2-1. */
      now: () => Date;
    },
  ) {}

  async execute(markdown: string): Promise<ImportExamResult> {
    const result = parseExam(markdown);
    if (!result.exam || result.errors.length > 0) throw new InvalidExamError(result.errors);

    const exam = newExam({ ...result.exam, sourceMarkdown: markdown, createdAt: this.deps.now() });
    const id = await this.deps.unitOfWork.run(ctx => ctx.exams.add(exam));
    return { exam: (await this.deps.exams.findSummary(id))!, warnings: result.warnings };
  }
}
