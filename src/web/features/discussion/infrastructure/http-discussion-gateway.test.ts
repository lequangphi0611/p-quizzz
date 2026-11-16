import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import { HttpDiscussionGateway } from './http-discussion-gateway.js';

describe('HttpDiscussionGateway', () => {
  it('talks to the unchanged mentor endpoints', async () => {
    const calls: unknown[][] = [];
    const rec = (m: string) => vi.fn(async (...a: unknown[]) => { calls.push([m, ...a]); return {}; });
    const g = new HttpDiscussionGateway({ get: rec('GET'), put: rec('PUT'), post: rec('POST') } as unknown as HttpClient);
    await g.getView(4);
    await g.gradeAnswer(9, { score: 2.5, feedback: 'ok' });
    await g.gradeAnswer(10, { score: 0 });
    await g.finalize(4);
    expect(calls).toEqual([
      ['GET', '/api/admin/sessions/4/discussion'],
      ['PUT', '/api/admin/answers/9/grade', { score: 2.5, feedback: 'ok' }],
      ['PUT', '/api/admin/answers/10/grade', { score: 0 }],
      ['POST', '/api/admin/sessions/4/finalize'],
    ]);
  });
});
