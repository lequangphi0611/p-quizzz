import type { RubricCriterion } from '../../../shared/rubric.js';
import type { RawSuggestion } from '../../domain/grading/ai-suggestion.js';

/** What the AI sees for one essay (PRODUCT.md §7.28c). Never a name, an email or an id. */
export interface EssayGradingInput {
  questionPrompt: string;
  questionBody: string;
  maxPoints: number;
  /** The question's explanation as written (model answer + rubric). */
  rubricText: string;
  /** The rubric split into scored criteria, when it could be (T1…Tn). */
  rubricCriteria: RubricCriterion[] | null;
  answerText: string;
}

export type EssayGraderFailure = 'unavailable' | 'timeout' | 'too_long' | 'bad_output' | 'process_failed';

const MESSAGES: Record<EssayGraderFailure, string> = {
  unavailable: 'AI chấm nháp chưa được bật',
  timeout: 'Quá thời gian',
  too_long: 'Bài quá dài để AI chấm',
  bad_output: 'AI trả kết quả không hợp lệ',
  process_failed: 'Mất kết nối tới AI',
};

/** A failed run. `message` is short Vietnamese for the mentor and never contains the configuration. */
export class EssayGraderError extends Error {
  constructor(
    readonly reason: EssayGraderFailure,
    message = MESSAGES[reason],
  ) {
    super(message);
    this.name = 'EssayGraderError';
  }
}

/** Grades one essay with an AI. The suggestion is checked by the domain before it is stored. */
export interface EssayGrader {
  /** Whether the mentor has set it up (a valid configuration). Cheap; read on every grading view. */
  available(): Promise<boolean>;
  suggest(input: EssayGradingInput): Promise<RawSuggestion>;
}
