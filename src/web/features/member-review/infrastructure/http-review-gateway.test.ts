import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import { HttpReviewGateway } from './http-review-gateway.js';

describe('HttpReviewGateway', () => {
  it('reads the member review endpoint', async () => {
    const get = vi.fn(async () => ({}));
    await new HttpReviewGateway({ get } as unknown as HttpClient).getReview(12);
    expect(get).toHaveBeenCalledWith('/api/me/attempts/12/review');
  });
});
