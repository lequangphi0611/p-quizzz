import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import { HttpSharedSessionsGateway } from './http-shared-sessions-gateway.js';

describe('HttpSharedSessionsGateway', () => {
  it('reads the public share endpoints with the token in the path', async () => {
    const get = vi.fn(async () => ({}));
    const g = new HttpSharedSessionsGateway({ get } as unknown as HttpClient);
    await g.list('ab/c');
    await g.get('tok', 7);
    expect(get).toHaveBeenNthCalledWith(1, '/api/shared/ab%2Fc/sessions');
    expect(get).toHaveBeenNthCalledWith(2, '/api/shared/tok/sessions/7');
  });
});
