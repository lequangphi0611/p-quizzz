import type { ReviewView } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { ReviewGateway } from '../application/review-gateway.js';

export class HttpReviewGateway implements ReviewGateway {
  constructor(private http: HttpClient) {}
  getReview(attemptId: number): Promise<ReviewView> { return this.http.get<ReviewView>(`/api/me/attempts/${attemptId}/review`); }
}
