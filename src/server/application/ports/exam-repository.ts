import type { Exam, NewExam, Question } from '../../domain/exam/exam.js';

/** An exam plus how much it is used: the list and detail screens show these counts. */
export interface ExamSummary {
  id: number;
  title: string;
  description: string | null;
  /** Default session time limit in minutes; null = no limit (PRODUCT.md §7.27). */
  durationMinutes: number | null;
  totalPoints: number;
  hasEssay: boolean;
  createdAt: Date;
  questionCount: number;
  /** Sessions run from this exam. A non-zero value blocks deletion. */
  sessionCount: number;
}

/** Read side. Safe to use on its own, outside a unit of work. */
export interface ExamReader {
  /** Newest first. */
  list(): Promise<ExamSummary[]>;
  findSummary(id: number): Promise<ExamSummary | null>;
  /** The full exam with questions and options in position order. */
  findById(id: number): Promise<Exam | null>;
  /** One question's type and option ids: what saving an answer must check, without loading the whole exam. */
  findQuestion(questionId: number): Promise<{ id: number; type: Question['type']; points: number; requireReason: boolean; optionIds: number[] } | null>;
  /** Most the automatic part can give (every non-essay question), as one aggregate query: members poll it. */
  maxAutoScoreOf(examId: number): Promise<number>;
}

/**
 * Write side. Only reachable through `ExamUnitContext`, i.e. inside `UnitOfWork.run`, so that
 * storing an exam with all its questions and options is all-or-nothing.
 */
export interface ExamRepository extends ExamReader {
  /** Stores the exam with its questions and options; returns the new exam id. */
  add(exam: NewExam): Promise<number>;
  /** Removes the exam together with its questions and options. */
  remove(id: number): Promise<void>;
}

/** What a unit of work hands to exam use cases. */
export interface ExamUnitContext {
  exams: ExamRepository;
}
