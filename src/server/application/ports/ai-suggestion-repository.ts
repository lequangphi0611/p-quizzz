import type { AiSuggestion, AiUse, RawSuggestion } from '../../domain/grading/ai-suggestion.js';
import type { AttemptUnitContext } from './attempt-repository.js';

/** Read side of `ai_suggestions`. */
export interface AiSuggestionReader {
  findById(id: number): Promise<AiSuggestion | null>;
  listByAnswerIds(answerIds: number[]): Promise<AiSuggestion[]>;
  /** Whether any essay of this session got a finished suggestion (the member review mentions it, §7.28f). */
  anyDoneInSession(sessionId: number): Promise<boolean>;
}

/** Write side, inside a unit of work. */
export interface AiSuggestionRepository extends AiSuggestionReader {
  /** A fresh `queued` row for each answer, replacing a failed one. Returns the row ids in the same order. */
  queue(answerIds: number[], requestedAt: Date): Promise<number[]>;
  markRunning(id: number): Promise<void>;
  complete(id: number, suggestion: RawSuggestion, finishedAt: Date): Promise<void>;
  fail(id: number, error: string, finishedAt: Date): Promise<void>;
  /** Removes the still-queued rows of these answers ("Dừng", or the mentor graded it by hand). Returns how many. */
  removeQueued(answerIds: number[]): Promise<number>;
  remove(id: number): Promise<void>;
  /** How the mentor used the suggestion when saving the grade; null = graded by hand or grade cleared. */
  setUsed(answerId: number, used: AiUse | null): Promise<void>;
  /** At startup: rows left queued/running by a previous process become failed. Returns how many. */
  failUnfinished(error: string, at: Date): Promise<number>;
}

/** Grading writes: the answer and its suggestion change together. */
export interface GradingUnitContext extends AttemptUnitContext {
  aiSuggestions: AiSuggestionRepository;
}

/** Runs queued suggestions in the background, one by one (or `concurrency` at a time). */
export interface SuggestionQueue {
  enqueue(suggestionIds: number[]): void;
}
