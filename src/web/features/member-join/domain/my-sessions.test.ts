import { describe, expect, it } from 'vitest';
import { MY_SESSIONS_KEPT, findMySessionByCode, forgetMySession, parseMySessions, recentMySessions, rememberMySession, type MySession } from './my-sessions.js';

const s = (sessionId: number, over: Partial<MySession> = {}): MySession => ({ sessionId, roomCode: String(100000 + sessionId), title: `Đề ${sessionId}`, joinedAt: sessionId, status: 'lobby', ...over });

describe('my sessions (PRODUCT.md §7.29)', () => {
  it('adds a session with the time it was first joined, newest first', () => {
    const list = rememberMySession(rememberMySession([], { sessionId: 1, roomCode: '111111', title: 'A' }, 10), { sessionId: 2, roomCode: '222222', title: 'B' }, 20);
    expect(list.map(x => x.sessionId)).toEqual([2, 1]);
    expect(list[1]).toEqual({ sessionId: 1, roomCode: '111111', title: 'A', joinedAt: 10, status: null });
  });

  it('updates title and status but never the join time or a known code; an unchanged entry returns the same list', () => {
    const list = [s(1, { roomCode: '111111', joinedAt: 5 })];
    const next = rememberMySession(list, { sessionId: 1, roomCode: '999999', title: 'Mới', status: 'closed' }, 99);
    expect(next[0]).toEqual({ sessionId: 1, roomCode: '111111', title: 'Mới', joinedAt: 5, status: 'closed' });
    expect(rememberMySession(next, { sessionId: 1, status: 'closed' }, 100)).toBe(next);
  });

  it('fills a missing code later (a session joined before the list existed)', () => {
    const list = [s(1, { roomCode: '' })];
    expect(rememberMySession(list, { sessionId: 1, roomCode: '123456' }, 1)[0]!.roomCode).toBe('123456');
  });

  it(`keeps at most ${MY_SESSIONS_KEPT} sessions, dropping the oldest`, () => {
    let list: MySession[] = [];
    for (let i = 1; i <= MY_SESSIONS_KEPT + 3; i++) list = rememberMySession(list, { sessionId: i, title: 'x' }, i);
    expect(list).toHaveLength(MY_SESSIONS_KEPT);
    expect(list.at(-1)!.sessionId).toBe(4);
  });

  it('forgets one session; forgetting an unknown one returns the same list', () => {
    const list = [s(1), s(2)];
    expect(forgetMySession(list, 1).map(x => x.sessionId)).toEqual([2]);
    expect(forgetMySession(list, 9)).toBe(list);
  });

  it('finds by room code; an empty code finds nothing', () => {
    const list = [s(1, { roomCode: '' }), s(2, { roomCode: '222222' })];
    expect(findMySessionByCode(list, '222222')?.sessionId).toBe(2);
    expect(findMySessionByCode(list, '')).toBeNull();
    expect(findMySessionByCode(list, '333333')).toBeNull();
  });

  it('lists the newest 10 by default', () => {
    const list = Array.from({ length: 12 }, (_, i) => s(i + 1));
    expect(recentMySessions(list).map(x => x.sessionId)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  });

  it('reads stored data defensively', () => {
    expect(parseMySessions('nope')).toEqual([]);
    expect(parseMySessions([null, { sessionId: 'x' }, { sessionId: -1 }, { sessionId: 3, roomCode: 'abc', title: 5, joinedAt: 'y', status: 'weird' }]))
      .toEqual([{ sessionId: 3, roomCode: '', title: '', joinedAt: 0, status: null }]);
    expect(parseMySessions([s(1)])).toEqual([s(1)]);
  });
});
