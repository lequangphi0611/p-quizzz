import { createContext, useContext, useEffect, useState } from 'react';
import type { ReviewView } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { ReviewGateway } from './review-gateway.js';

export const ReviewGatewayContext = createContext<ReviewGateway | null>(null);

export interface ReviewError { message: string; status: number }

/** Loads one attempt's review; a response that arrives after the attempt changed is dropped. */
export function useReview(attemptId: string | undefined): { review: ReviewView | null; error: ReviewError | null } {
  const gateway = useContext(ReviewGatewayContext);
  if (!gateway) throw new Error('ReviewGatewayContext.Provider is missing above this component');
  const [review, setReview] = useState<ReviewView | null>(null);
  const [error, setError] = useState<ReviewError | null>(null);
  useEffect(() => {
    let live = true;
    gateway.getReview(Number(attemptId))
      .then(r => { if (live) setReview(r); })
      .catch(err => { if (live) setError({ message: err instanceof ApiError ? err.message : 'Không tải được bài làm', status: err instanceof ApiError ? err.status : 0 }); });
    return () => { live = false; };
  }, [gateway, attemptId]);
  return { review, error };
}
