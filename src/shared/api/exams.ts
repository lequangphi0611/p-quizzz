import { z } from 'zod';
import type { ExamIssue, QuestionType } from '../exam-format/index.js';

// Request body shared by POST /api/admin/exams/preview and POST /api/admin/exams.
export const ExamMarkdownBody = z.object({
  markdown: z.string().min(1, 'Nội dung đề trống'),
});

// Same limit the server enforces on these routes.
export const EXAM_BODY_LIMIT_BYTES = 1024 * 1024;

export interface ExamSummary {
  id: number;
  title: string;
  description: string | null;
  questionCount: number;
  totalPoints: number;
  hasEssay: boolean;
  createdAt: number; // epoch ms
  sessionCount: number;
}

export interface ExamOptionDetail {
  id: number;
  position: number;
  text: string;
  isCorrect: boolean;
}

export interface ExamQuestionDetail {
  id: number;
  position: number;
  type: QuestionType;
  prompt: string;
  body: string;
  points: number;
  explanation: string | null;
  options: ExamOptionDetail[];
}

// Mentor-only: includes answers and explanations.
export interface ExamDetail extends ExamSummary {
  sourceMarkdown: string;
  questions: ExamQuestionDetail[];
}

export interface CreateExamResponse {
  exam: ExamSummary;
  warnings: ExamIssue[];
}

export interface ExamImportErrorResponse {
  error: string;
  errors: ExamIssue[];
}
