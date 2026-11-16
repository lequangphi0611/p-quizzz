import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import { HttpSessionAdminGateway } from './http-session-admin-gateway.js';

describe('HttpSessionAdminGateway', () => {
  it('talks to the unchanged endpoints', async () => {
    const calls: unknown[][] = [];
    const rec = (m: string) => vi.fn(async (...a: unknown[]) => { calls.push([m, ...a]); return { joinHosts: [] }; });
    const g = new HttpSessionAdminGateway({ get: rec('GET'), post: rec('POST'), patch: rec('PATCH') } as unknown as HttpClient);
    await g.listSessions(); await g.listExams();
    await g.createSession({ examId: 2, shuffle: true, autoApprove: false });
    await g.getSession(5); await g.runAction(5, 'start');
    await g.approveParticipant(8); await g.kickParticipant(9); await g.renameParticipant(8, 'An B');
    await g.getParticipantReview(8); await g.getLeaderboard(5); await g.getJoinHosts();
    expect(calls).toEqual([
      ['GET', '/api/admin/sessions'], ['GET', '/api/admin/exams'],
      ['POST', '/api/admin/sessions', { examId: 2, shuffle: true, autoApprove: false }],
      ['GET', '/api/admin/sessions/5'], ['POST', '/api/admin/sessions/5/start'],
      ['POST', '/api/admin/participants/8/approve'], ['POST', '/api/admin/participants/9/kick'],
      ['PATCH', '/api/admin/participants/8', { displayName: 'An B' }],
      ['GET', '/api/admin/participants/8/review'], ['GET', '/api/sessions/5/leaderboard'], ['GET', '/api/network'],
    ]);
  });
});
