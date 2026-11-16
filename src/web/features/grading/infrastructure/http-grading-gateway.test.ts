import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import { HttpGradingGateway } from './http-grading-gateway.js';

describe('HttpGradingGateway', () => {
  it('talks to the unchanged mentor endpoints', async () => {
    const calls: unknown[][] = [];
    const rec = (m: string) => vi.fn(async (...a: unknown[]) => { calls.push([m, ...a]); return {}; });
    const g = new HttpGradingGateway({ get: rec('GET'), put: rec('PUT'), post: rec('POST') } as unknown as HttpClient);
    await g.getGrading(3); await g.getSession(3); await g.grade(8, { score: 1.5, feedback: 'x' }); await g.finalize(3);
    expect(calls).toEqual([
      ['GET', '/api/admin/sessions/3/grading'], ['GET', '/api/admin/sessions/3'],
      ['PUT', '/api/admin/answers/8/grade', { score: 1.5, feedback: 'x' }], ['POST', '/api/admin/sessions/3/finalize'],
    ]);
  });
});
