import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import { HttpScreenGateway } from './http-screen-gateway.js';

describe('HttpScreenGateway', () => {
  it('reads one session\'s public data and the mentor-machine routes', async () => {
    const urls: string[] = [];
    const get = vi.fn(async (u: string) => { urls.push(u); return { joinHosts: ['192.0.2.1:3000'] }; });
    const g = new HttpScreenGateway({ get } as unknown as HttpClient);
    await g.getSession(3); await g.listSessions(); await g.getParticipants(3); await g.getLeaderboard(3); await g.getRosterCounts(3); await g.getRoom(3);
    expect(await g.getJoinHosts()).toEqual(['192.0.2.1:3000']);
    expect(urls).toEqual(['/api/sessions/3/public', '/api/screen/sessions', '/api/sessions/3/participants', '/api/sessions/3/leaderboard', '/api/sessions/3/roster-counts', '/api/screen/sessions/3/room', '/api/network']);
  });
});
