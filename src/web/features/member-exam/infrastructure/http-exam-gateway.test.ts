import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import { HttpExamGateway } from './http-exam-gateway.js';

function fakeHttp() {
  const calls: [string, string, unknown?][] = [];
  const rec = (m: string) => vi.fn(async (path: string, body?: unknown) => { calls.push([m, path, body]); return { ok: true }; });
  const http = { get: rec('GET'), post: rec('POST'), put: rec('PUT'), patch: rec('PATCH'), delete: rec('DELETE') } as unknown as HttpClient;
  return { http, calls };
}

describe('HttpExamGateway', () => {
  it('talks to the unchanged member endpoints', async () => {
    const { http, calls } = fakeHttp();
    const g = new HttpExamGateway(http);
    await g.startAttempt();
    await g.getAttempt(7);
    await g.saveAnswer(7, 3, { selectedOptionIds: [1] });
    await g.saveAnswer(7, 4, { textAnswer: 'x' });
    await g.submitAttempt(7);
    expect(calls).toEqual([
      ['POST', '/api/me/attempts', undefined],
      ['GET', '/api/me/attempts/7', undefined],
      ['PUT', '/api/me/attempts/7/answers/3', { selectedOptionIds: [1] }],
      ['PUT', '/api/me/attempts/7/answers/4', { textAnswer: 'x' }],
      ['POST', '/api/me/attempts/7/submit', undefined],
    ]);
  });

  it('lets errors through for the application layer to interpret', async () => {
    const http = { put: vi.fn(async () => { throw new Error('boom'); }) } as unknown as HttpClient;
    await expect(new HttpExamGateway(http).saveAnswer(1, 1, { textAnswer: '' })).rejects.toThrow('boom');
  });
});
