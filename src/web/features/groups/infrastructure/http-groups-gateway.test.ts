import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import { HttpGroupsGateway } from './http-groups-gateway.js';

describe('HttpGroupsGateway', () => {
  it('talks to the mentor-only group endpoints', async () => {
    const calls: unknown[][] = [];
    const rec = (m: string) => vi.fn(async (...a: unknown[]) => { calls.push([m, ...a]); return {}; });
    const g = new HttpGroupsGateway({ get: rec('GET'), post: rec('POST'), put: rec('PUT'), delete: rec('DELETE') } as unknown as HttpClient);
    await g.list(); await g.get(3); await g.create({ name: 'A', emails: ['a@x.com'] }); await g.update(3, { name: 'B', emails: [] }); await g.remove(3);
    expect(calls).toEqual([
      ['GET', '/api/admin/groups'], ['GET', '/api/admin/groups/3'],
      ['POST', '/api/admin/groups', { name: 'A', emails: ['a@x.com'] }],
      ['PUT', '/api/admin/groups/3', { name: 'B', emails: [] }],
      ['DELETE', '/api/admin/groups/3'],
    ]);
  });
});
