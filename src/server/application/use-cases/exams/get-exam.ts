import type { Exam } from '../../../domain/exam/exam.js';
import { ExamNotFoundError } from '../../../domain/exam/errors.js';
import type { ExamReader, ExamSummary } from '../../ports/exam-repository.js';

export interface ExamDetail {
  summary: ExamSummary;
  exam: Exam;
}

export class GetExam {
  constructor(private readonly exams: ExamReader) {}

  async execute(id: number): Promise<ExamDetail> {
    const [summary, exam] = await Promise.all([this.exams.findSummary(id), this.exams.findById(id)]);
    if (!summary || !exam) throw new ExamNotFoundError();
    return { summary, exam };
  }
}
