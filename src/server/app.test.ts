import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { createDb } from './infrastructure/db/client.js';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const app = await buildApp({ db: createDb(':memory:') });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });
});
