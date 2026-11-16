import type { ExamReader, ExamSummary } from '../../ports/exam-repository.js';

export class ListExams {
  constructor(private readonly exams: ExamReader) {}

  execute(): Promise<ExamSummary[]> {
    return this.exams.list();
  }
}
