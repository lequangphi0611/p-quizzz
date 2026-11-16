import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import { HttpScreenGateway } from './http-screen-gateway.js';

describe('HttpScreenGateway', () => {
  it('reads the unchanged public endpoints', async () => {
    const urls: string[] = [];
    const get = vi.fn(async (u: string) => { urls.push(u); return { joinHosts: ['192.0.2.1:3000'] }; });
    const g = new HttpScreenGateway({ get } as unknown as HttpClient);
    await g.getLatest(); await g.getParticipants(3); await g.getLeaderboard(3); await g.getRoom();
    expect(await g.getJoinHosts()).toEqual(['192.0.2.1:3000']);
    expect(urls).toEqual(['/api/sessions/latest', '/api/sessions/3/participants', '/api/sessions/3/leaderboard', '/api/screen/room', '/api/network']);
  });
});
