import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '../../../shared/api-client/http-client.js';
import { HttpTrainingMemberGateway } from './http-training-member-gateway.js';

describe('HttpTrainingMemberGateway', () => {
  it('joins with consent: true and sends the member token as a header on every later call', async () => {
    const f = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}', { status: 200 }));
    const g = new HttpTrainingMemberGateway(createHttpClient({ fetch: f as unknown as typeof fetch }));
    await g.join(5, { displayName: 'Lan', roomCode: '123456' });
    await g.me('tok');
    await g.hookConfig('tok');
    await g.startUninstallCheck('tok');
    await g.finishUninstallCheck('tok');
    await g.withdraw('tok');
    const calls = f.mock.calls.map(c => [(c[1] as RequestInit).method, c[0], (c[1] as RequestInit).headers]);
    expect(calls[0]).toEqual(['POST', '/api/trainings/5/join', { 'Content-Type': 'application/json' }]);
    expect(JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string)).toEqual({ displayName: 'Lan', roomCode: '123456', consent: true });
    expect(calls.slice(1).map(c => [c[0], c[1]])).toEqual([
      ['GET', '/api/training/me'], ['GET', '/api/training/me/hook-config'], ['POST', '/api/training/me/uninstall-check'],
      ['POST', '/api/training/me/uninstall-check/finish'], ['DELETE', '/api/training/me'],
    ]);
    for (const c of calls.slice(1)) expect(c[2]).toMatchObject({ 'x-training-member-token': 'tok' });
  });
});
