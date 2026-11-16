import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import { HttpAdminAuthGateway } from './http-admin-auth-gateway.js';

describe('HttpAdminAuthGateway', () => {
  it('uses the unchanged admin auth endpoints', async () => {
    const calls: unknown[][] = [];
    const rec = (m: string) => vi.fn(async (...a: unknown[]) => { calls.push([m, ...a]); return {}; });
    const g = new HttpAdminAuthGateway({ get: rec('GET'), post: rec('POST') } as unknown as HttpClient);
    await g.getStatus(); await g.login('pw'); await g.setup('pw'); await g.logout();
    expect(calls).toEqual([['GET', '/api/admin/status'], ['POST', '/api/admin/login', { password: 'pw' }], ['POST', '/api/admin/setup', { password: 'pw' }], ['POST', '/api/admin/logout']]);
  });
});
