import { describe, expect, it } from 'vitest';
import { InMemoryTokenStore } from '../token-store/in-memory-token-store.js';
import type { OutgoingRequest } from './http-client.js';
import { participantAuth, sessionIdForPath } from './participant-auth.js';

const run = (store: InMemoryTokenStore, path: string) => {
  const req: OutgoingRequest = { method: 'GET', path, headers: {} };
  participantAuth(store)(req);
  return req.headers;
};

describe('participantAuth', () => {
  it('attaches the token of the session named in the path', () => {
    const s = new InMemoryTokenStore();
    s.setToken(5, 'tok5');
    s.setToken(6, 'tok6');
    expect(run(s, '/api/sessions/5/attempt')).toEqual({ 'X-Participant-Token': 'tok5' });
    expect(run(s, '/api/sessions/6')).toEqual({ 'X-Participant-Token': 'tok6' });
    expect(run(s, '/api/sessions/5?x=1')).toEqual({ 'X-Participant-Token': 'tok5' });
  });

  it('uses the current session for /api/me/*', () => {
    const s = new InMemoryTokenStore();
    s.setToken(5, 'tok5');
    expect(run(s, '/api/me')).toEqual({});
    s.setCurrentSessionId(5);
    expect(run(s, '/api/me')).toEqual({ 'X-Participant-Token': 'tok5' });
    expect(run(s, '/api/me/attempt')).toEqual({ 'X-Participant-Token': 'tok5' });
  });

  it('/api/rejoin/* carries the current session\'s token too: while asking to be let back in it is the REQUEST token', () => {
    const s = new InMemoryTokenStore();
    s.setToken(5, 'req-tok');
    s.setCurrentSessionId(5);
    expect(run(s, '/api/rejoin/status')).toEqual({ 'X-Participant-Token': 'req-tok' });
    expect(run(s, '/api/rejoin/cancel')).toEqual({ 'X-Participant-Token': 'req-tok' });
    expect(run(new InMemoryTokenStore(), '/api/rejoin/status')).toEqual({});
  });

  it('sends nothing when there is no token or the path is not a member path', () => {
    const s = new InMemoryTokenStore();
    s.setToken(5, 'tok5');
    s.setCurrentSessionId(5);
    expect(run(s, '/api/sessions/9/attempt')).toEqual({});
    expect(run(s, '/api/admin/exams')).toEqual({});
    expect(run(s, '/api/meeting')).toEqual({});
    expect(sessionIdForPath('/api/sessions/abc', s)).toBeNull();
  });
});
