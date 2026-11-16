import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import { HttpMentorNoticesGateway } from './http-mentor-notices-gateway.js';
import { LocalStorageSeenStore } from './local-storage-seen-store.js';

afterEach(() => vi.unstubAllGlobals());

describe('HttpMentorNoticesGateway', () => {
  it('uses the unchanged endpoints', async () => {
    const calls: unknown[][] = [];
    const rec = (m: string) => vi.fn(async (...a: unknown[]) => { calls.push([m, ...a]); return {}; });
    const g = new HttpMentorNoticesGateway({ get: rec('GET'), post: rec('POST') } as unknown as HttpClient);
    await g.listActive(); await g.getSession(3); await g.approveParticipant(9); await g.answerRejoin(4, 'keep'); await g.answerRejoin(4, 'takeover'); await g.answerRejoin(4, 'reject');
    expect(calls).toEqual([['GET', '/api/admin/sessions?active=true'], ['GET', '/api/admin/sessions/3'], ['POST', '/api/admin/participants/9/approve'], ['POST', '/api/admin/rejoin-requests/4/approve-keep'], ['POST', '/api/admin/rejoin-requests/4/approve-takeover'], ['POST', '/api/admin/rejoin-requests/4/reject']]);
  });
});

describe('LocalStorageSeenStore', () => {
  it('keeps a per-session mark under the same key as before, and survives blocked storage', () => {
    const m = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) });
    const s = new LocalStorageSeenStore();
    expect(s.load(1)).toBe(0);
    s.save(1, 500);
    expect(s.load(1)).toBe(500);
    expect(s.load(2)).toBe(0);
    expect([...m.keys()]).toEqual(['pq:mentor:notices-seen:1']);
    const blocked = () => { throw new Error('blocked'); };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(() => s.save(1, 1)).not.toThrow();
    expect(s.load(1)).toBe(0);
  });
});
