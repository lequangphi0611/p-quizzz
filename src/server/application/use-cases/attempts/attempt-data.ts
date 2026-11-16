import type { Answer, Attempt } from '../../../domain/attempt/attempt.js';
import type { Exam } from '../../../domain/exam/exam.js';
import type { SessionStatus } from '../../../../shared/session-state.js';

/** Everything the member's question screen is built from. ⚠️ `exam` carries the key: the presenter must pick fields one by one. */
export interface AttemptViewData {
  attempt: Attempt;
  answers: Answer[];
  exam: Exam;
}

/** Everything a review is built from. Only produced after the access rules were checked (member: from CLOSED; mentor: any time). */
export interface ReviewData extends AttemptViewData {
  sessionStatus: SessionStatus;
}
