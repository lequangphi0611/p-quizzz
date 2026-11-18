import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import { HttpMemberGateway } from './http-member-gateway.js';
import { SessionStorageRoomCodeMemory } from './session-storage-room-code-memory.js';

afterEach(() => vi.unstubAllGlobals());

describe('HttpMemberGateway', () => {
  it('finds the session by room code, then talks to the member endpoints', async () => {
    const calls: unknown[][] = [];
    const rec = (m: string) => vi.fn(async (...a: unknown[]) => { calls.push([m, ...a]); return {}; });
    const g = new HttpMemberGateway({ get: rec('GET'), post: rec('POST') } as unknown as HttpClient);
    await g.resolveRoom('123456'); await g.getMe(); await g.join(4, { displayName: 'An', roomCode: '123456' });
    expect(calls).toEqual([['POST', '/api/rooms/resolve', { roomCode: '123456' }], ['GET', '/api/me'], ['POST', '/api/sessions/4/join', { displayName: 'An', roomCode: '123456' }]]);
  });
});

describe('SessionStorageRoomCodeMemory', () => {
  it('remembers per session and survives broken storage', () => {
    const m = new Map<string, string>();
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) });
    const mem = new SessionStorageRoomCodeMemory();
    expect(mem.recall(1)).toBe('');
    mem.remember(1, '123456');
    expect(mem.recall(1)).toBe('123456');
    expect(mem.recall(2)).toBe('');
    const blocked = () => { throw new Error('blocked'); };
    vi.stubGlobal('sessionStorage', { getItem: blocked, setItem: blocked });
    expect(() => mem.remember(1, 'x')).not.toThrow();
    expect(mem.recall(1)).toBe('');
  });
});

describe('LocalStorageMySessionsStore', () => {
  it('round-trips the list, drops malformed data and survives broken storage', async () => {
    const { LocalStorageMySessionsStore } = await import('./local-storage-my-sessions-store.js');
    const m = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) });
    const store = new LocalStorageMySessionsStore();
    expect(store.load()).toEqual([]);
    const entry = { sessionId: 4, roomCode: '123456', title: 'Đề', joinedAt: 1, status: 'closed' as const };
    store.save([entry]);
    expect(store.load()).toEqual([entry]);
    m.set('pq-my-sessions', '{not json');
    expect(store.load()).toEqual([]);
    const blocked = () => { throw new Error('blocked'); };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(() => store.save([entry])).not.toThrow();
    expect(store.load()).toEqual([]);
  });
});

describe('HttpMemberGateway.getPublicSession', () => {
  it('reads the public session endpoint', async () => {
    const get = vi.fn(async () => ({}));
    await new HttpMemberGateway({ get } as unknown as HttpClient).getPublicSession(7);
    expect(get).toHaveBeenCalledWith('/api/sessions/7/public');
  });
});
