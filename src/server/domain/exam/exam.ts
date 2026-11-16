import type { QuestionType } from '../../../shared/exam-format/index.js';

export type { QuestionType };

// An exam is immutable once created: there is no way to change one, only to create or delete it.

export interface Option {
  id: number;
  position: number;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: number;
  position: number;
  type: QuestionType;
  prompt: string;
  body: string;
  points: number;
  explanation: string | null;
  options: Option[];
}

export interface Exam {
  id: number;
  title: string;
  description: string | null;
  /** The imported file, verbatim. */
  sourceMarkdown: string;
  totalPoints: number;
  hasEssay: boolean;
  createdAt: Date;
  questions: Question[]; // ordered by position
}

// What `newExam` produces: an exam that has not been stored yet, so nothing has an id.
export type NewOption = Omit<Option, 'id'>;
export type NewQuestion = Omit<Question, 'id' | 'options'> & { options: NewOption[] };
export type NewExam = Omit<Exam, 'id' | 'questions'> & { questions: NewQuestion[] };

export interface NewExamInput {
  title: string;
  description: string | null;
  sourceMarkdown: string;
  createdAt: Date;
  questions: {
    type: QuestionType;
    prompt: string;
    body: string;
    points: number;
    explanation: string | null;
    options: { text: string; correct: boolean }[];
  }[];
}

/** Builds a new exam: numbers questions and options from 1 and derives `totalPoints` and `hasEssay`. */
export function newExam(input: NewExamInput): NewExam {
  const questions: NewQuestion[] = input.questions.map((q, qi) => ({
    position: qi + 1,
    type: q.type,
    prompt: q.prompt,
    body: q.body,
    points: q.points,
    explanation: q.explanation,
    options: q.options.map((o, oi) => ({ position: oi + 1, text: o.text, isCorrect: o.correct })),
  }));
  return {
    title: input.title,
    description: input.description,
    sourceMarkdown: input.sourceMarkdown,
    createdAt: input.createdAt,
    totalPoints: questions.reduce((sum, q) => sum + q.points, 0),
    hasEssay: questions.some(q => q.type === 'essay'),
    questions,
  };
}
