import type { ReviewView } from '../../../../shared/api/index.js';

/** Port: the member's own attempt with the answer key (the server answers 403 until the session is over). */
export interface ReviewGateway {
  getReview(attemptId: number): Promise<ReviewView>;
}
