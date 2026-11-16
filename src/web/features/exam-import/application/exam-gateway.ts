import type { CreateExamResponse, ExamDetail, ExamSummary } from '../../../../shared/api/index.js';
import type { ParseResult } from '../../../../shared/exam-format/index.js';

/** Port: the mentor's exam library (preview, import, list, read, delete). Failures reject with `ApiError`. */
export interface ExamLibraryGateway {
  /** Parse and validate Markdown on the server (the same parser as import). */
  previewExam(markdown: string): Promise<ParseResult>;
  importExam(markdown: string): Promise<CreateExamResponse>;
  listExams(): Promise<ExamSummary[]>;
  getExam(id: number): Promise<ExamDetail>;
  deleteExam(id: number): Promise<void>;
}
