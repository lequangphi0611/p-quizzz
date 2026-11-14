// Parsed representation of an exam Markdown file. Format spec: docs/exam-format.md.

export type QuestionType = 'single' | 'multi' | 'essay';

export interface ParsedOption {
  text: string; // inline Markdown
  correct: boolean;
}

export interface ParsedQuestion {
  type: QuestionType;
  prompt: string; // heading text without the {meta} suffix
  body: string; // Markdown between heading and options (may contain code blocks), '' if none
  options: ParsedOption[]; // empty for essay
  points: number;
  explanation: string | null; // MCQ: why; essay: model answer / rubric
  line: number; // 1-based line of the heading
}

export interface ParsedExam {
  title: string;
  description: string | null;
  questions: ParsedQuestion[];
  totalPoints: number;
  hasEssay: boolean;
}

export interface ExamIssue {
  line: number; // 1-based
  message: string; // Vietnamese, shown to the mentor
}

export interface ParseResult {
  exam: ParsedExam | null; // null when there is at least one error
  errors: ExamIssue[];
  warnings: ExamIssue[];
}
