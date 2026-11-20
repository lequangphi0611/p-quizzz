import type { Answer, Attempt } from '../../../domain/attempt/attempt.js';
import type { Exam } from '../../../domain/exam/exam.js';
import type { SessionStatus } from '../../../../shared/session-state.js';

/** Everything the member's question screen is built from. ⚠️ `exam` carries the key: the presenter must pick fields one by one. */
export interface AttemptViewData {
  attempt: Attempt;
  answers: Answer[];
  exam: Exam;
  sessionStatus: SessionStatus;
}

/** Everything a review is built from. Only produced after the access rules were checked (member: from CLOSED; mentor: any time). */
export type ReviewData = AttemptViewData & {
  /** Essay questions of the session that got AI grading suggestions (the member review says so, PRODUCT.md §7.28f). */
  aiAssistedQuestionIds?: number[];
  /** The session is on the share page (PRODUCT.md §7.33f): the review says so. */
  shared?: boolean;
};
