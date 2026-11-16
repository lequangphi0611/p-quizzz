import type { ExamIssue } from '../../../../shared/exam-format/index.js';
import { DomainError } from '../../../domain/errors.js';

/** The Markdown could not be parsed into an exam. `errors` are line-numbered messages for the mentor. */
export class InvalidExamError extends DomainError {
  constructor(readonly errors: ExamIssue[]) {
    super('invalid', 'Đề có lỗi, chưa import được');
  }
}
