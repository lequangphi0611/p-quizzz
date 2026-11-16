import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSession, MeResponse } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { InMemoryTokenStore } from '../../../shared/token-store/in-memory-token-store.js';
import type { MemberGateway, RoomCodeMemory } from './member-gateway.js';
import { MemberHomeController, selectFollowedId, selectRoom, selectScreen } from './member-home-controller.js';

const found = (id = 1, status: ActiveSession['status'] = 'lobby'): ActiveSession => ({ id, title: 'T', status } as ActiveSession);
const me = (id = 1, status = 'lobby', participant = 'active', attemptCurrent: unknown = null): MeResponse => ({ session: { id, status, title: 'T' }, participant: { status: participant, displayName: 'An' }, attempt: { current: attemptCurrent, submitted: [] } } as unknown as MeResponse);

function make(over: Partial<MemberGateway> = {}, tokens = new InMemoryTokenStore()) {
  const memory = new Map<number, string>();
  const rooms: RoomCodeMemory = { remember: (id, c) => void memory.set(id, c), recall: id => memory.get(id) ?? '' };
  const gateway: MemberGateway = {
    resolveRoom: vi.fn(async () => found()), getMe: vi.fn(async () => me()), join: vi.fn(async () => ({ token: 'tok' }) as never),
    requestRejoin: vi.fn(async () => ({ requestId: 7, token: 'req-tok', status: 'pending' as const })),
    getRejoinStatus: vi.fn(async () => ({ status: 'pending' as const, sessionId: 1 })),
    cancelRejoin: vi.fn(async () => {}),
    ...over,
  };
  return { gateway, tokens, rooms, ctrl: new MemberHomeController(gateway, tokens, rooms, 1000) };
}
const settle = () => vi.advanceTimersByTimeAsync(0);
const inSession = (id = 1) => { const t = new InMemoryTokenStore(); t.setToken(id, 'tok'); t.setCurrentSessionId(id); return t; };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('MemberHomeController: finding a room by its code', () => {
  it('starts at the code step; a complete code finds the session and moves to the name step', async () => {
    const { ctrl, gateway } = make();
    expect(selectScreen(ctrl.getState())).toBe('code');
    await ctrl.lookUpRoom('482 913');
    expect(gateway.resolveRoom).toHaveBeenCalledWith('482913');
    expect(selectRoom(ctrl.getState())).toMatchObject({ id: 1, title: 'T' });
    expect(selectScreen(ctrl.getState())).toBe('join');
  });

  it('an incomplete code asks nothing and forgets what an earlier code found', async () => {
    const { ctrl, gateway } = make();
    await ctrl.lookUpRoom('482913');
    await ctrl.lookUpRoom('4829');
    expect(gateway.resolveRoom).toHaveBeenCalledTimes(1);
    expect(selectScreen(ctrl.getState())).toBe('code');
  });

  it('does not ask again for a code that is being looked up or was found (every wrong code counts at the server)', async () => {
    const { ctrl, gateway } = make();
    await Promise.all([ctrl.lookUpRoom('482913'), ctrl.lookUpRoom('482913')]);
    await ctrl.lookUpRoom('482913');
    expect(gateway.resolveRoom).toHaveBeenCalledTimes(1);
  });

  it('a wrong code keeps the code step and records the failure; the same code can be retried', async () => {
    let n = 0;
    const { ctrl, gateway } = make({ resolveRoom: vi.fn(async () => { if (n++ === 0) throw new ApiError(403, 'Mã phòng không đúng'); return found(); }) });
    await ctrl.lookUpRoom('000000');
    expect(selectScreen(ctrl.getState())).toBe('code');
    expect(ctrl.getState().lookup).toMatchObject({ code: '000000', status: 'error', error: { status: 403 } });
    await ctrl.lookUpRoom('000000'); // after an error the same code is allowed again (e.g. a network hiccup)
    expect(gateway.resolveRoom).toHaveBeenCalledTimes(2);
    expect(selectScreen(ctrl.getState())).toBe('join');
  });

  it('a lookup that is overtaken by a newer code is dropped', async () => {
    let release: (s: ActiveSession) => void = () => {};
    const slow = new Promise<ActiveSession>(r => { release = r; });
    const { ctrl } = make({ resolveRoom: vi.fn().mockReturnValueOnce(slow).mockResolvedValueOnce(found(2)) });
    const first = ctrl.lookUpRoom('111111');
    await ctrl.lookUpRoom('222222');
    release(found(1));
    await first;
    expect(selectRoom(ctrl.getState())?.id).toBe(2);
  });

  it('a session this browser is already in is resumed instead of asking for a name again', async () => {
    const t = new InMemoryTokenStore(); t.setToken(2, 'tok');
    const { ctrl } = make({ resolveRoom: async () => found(2), getMe: async () => me(2) }, t);
    await ctrl.lookUpRoom('222222');
    await settle();
    expect(selectFollowedId(ctrl.getState())).toBe(2);
    expect(t.getCurrentSessionId()).toBe('2');
    expect(selectScreen(ctrl.getState())).toBe('lobby');
  });

  it('a join link for ANOTHER session wins over the one this tab was in (parallel sessions)', async () => {
    const t = inSession(1);
    const { ctrl } = make({ resolveRoom: async () => found(2) }, t);
    await settle();
    expect(selectFollowedId(ctrl.getState())).toBe(1);
    await ctrl.lookUpRoom('222222');
    expect(selectFollowedId(ctrl.getState())).toBeNull();
    expect(selectScreen(ctrl.getState())).toBe('join');
    expect(t.getToken(1)).toBe('tok'); // the first session's token is untouched
  });
});

describe('MemberHomeController: following a session', () => {
  it('with a token it loads the member state and shows the lobby', async () => {
    const { ctrl, gateway } = make({}, inSession());
    expect(selectScreen(ctrl.getState())).toBe('loading');
    await settle();
    expect(gateway.getMe).toHaveBeenCalled();
    expect(selectScreen(ctrl.getState())).toBe('lobby');
  });

  it('keeps following the session after it ends (the result stays on screen)', async () => {
    const { ctrl } = make({ getMe: async () => me(1, 'closed') }, inSession());
    await settle();
    expect(selectFollowedId(ctrl.getState())).toBe(1);
    expect(selectScreen(ctrl.getState())).toBe('ended');
  });

  it('401 (unknown token, e.g. DB reset): forgets the token and starts over at the code step', async () => {
    const t = inSession();
    const { ctrl } = make({ getMe: async () => { throw new ApiError(401, 'x'); } }, t);
    await settle();
    expect(t.getToken(1)).toBeNull();
    expect(t.getCurrentSessionId()).toBeNull();
    expect(selectScreen(ctrl.getState())).toBe('code');
  });

  it('403 means kicked; leaveKicked clears the token and looks the room up again with the remembered code', async () => {
    const t = inSession();
    const { ctrl, rooms, gateway } = make({ getMe: async () => { throw new ApiError(403, 'x'); } }, t);
    rooms.remember(1, '482913');
    await settle();
    expect(selectScreen(ctrl.getState())).toBe('kicked');
    ctrl.leaveKicked();
    await settle();
    expect(t.getToken(1)).toBeNull();
    expect(gateway.resolveRoom).toHaveBeenCalledWith('482913');
    expect(selectScreen(ctrl.getState())).toBe('join');
  });

  it('"another room" on the result screen keeps the token but leaves the session', async () => {
    const t = inSession();
    const { ctrl } = make({ getMe: async () => me(1, 'finalized') }, t);
    await settle();
    expect(selectScreen(ctrl.getState())).toBe('ended');
    ctrl.leaveEnded();
    expect(selectScreen(ctrl.getState())).toBe('code');
    expect(t.getToken(1)).toBe('tok');
    expect(t.getCurrentSessionId()).toBeNull();
  });

  it('a network error on the first member load shows the error screen, but never replaces a state we already have', async () => {
    let fail = true;
    const { ctrl } = make({ getMe: async () => { if (fail) throw new ApiError(0, 'down'); return me(); } }, inSession());
    await settle();
    expect(selectScreen(ctrl.getState())).toBe('error');
    fail = false;
    await ctrl.refreshMe();
    expect(selectScreen(ctrl.getState())).toBe('lobby');
    fail = true;
    await ctrl.refreshMe();
    expect(selectScreen(ctrl.getState())).toBe('lobby');
  });

  it('join stores the token, current session and room code; joined then loads the member', async () => {
    const { ctrl, tokens, rooms, gateway } = make();
    await ctrl.lookUpRoom('123456');
    await ctrl.join(1, 'An', '123456');
    expect(gateway.join).toHaveBeenCalledWith(1, { displayName: 'An', roomCode: '123456' });
    expect(tokens.getToken(1)).toBe('tok');
    expect(tokens.getCurrentSessionId()).toBe('1');
    expect(rooms.recall(1)).toBe('123456');
    await ctrl.joined(1);
    expect(selectScreen(ctrl.getState())).toBe('lobby');
  });

  it('a roster join sends the email with the name; a free join sends none', async () => {
    const { ctrl, gateway } = make();
    await ctrl.join(1, 'Phi', '123456', 'phi78@gmail.com');
    expect(gateway.join).toHaveBeenLastCalledWith(1, { displayName: 'Phi', roomCode: '123456', email: 'phi78@gmail.com' });
    await ctrl.join(1, 'An', '123456');
    expect(gateway.join).toHaveBeenLastCalledWith(1, { displayName: 'An', roomCode: '123456' });
  });

  it('a failed join leaves nothing stored and rejects for the form', async () => {
    const { ctrl, tokens } = make({ join: async () => { throw new ApiError(403, 'Mã phòng không đúng'); } });
    await expect(ctrl.join(1, 'An', '000000')).rejects.toThrow('Mã phòng không đúng');
    expect(tokens.getToken(1)).toBeNull();
  });

  it('polls the followed session on an interval until stopped, and not at all when in no session', async () => {
    const idle = make();
    const stopIdle = idle.ctrl.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(idle.gateway.getMe).not.toHaveBeenCalled();
    stopIdle();

    const { ctrl, gateway } = make({}, inSession());
    const stop = ctrl.start();
    await settle();
    expect(gateway.getMe).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(gateway.getMe).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(3000);
    expect(gateway.getMe).toHaveBeenCalledTimes(3);
  });

  it('notices the auto-submit when the session closes under a working member', async () => {
    let status = 'running';
    const { ctrl } = make({ getMe: async () => me(1, status, 'active', status === 'running' ? { id: 9 } : null) }, inSession());
    await settle();
    expect(selectScreen(ctrl.getState())).toBe('running');
    expect(ctrl.getState().autoSubmitted).toBe(false);
    status = 'closed';
    await ctrl.refreshMe();
    expect(selectScreen(ctrl.getState())).toBe('ended');
    expect(ctrl.getState().autoSubmitted).toBe(true);
  });
});

describe('MemberHomeController: asking the mentor to let this person back in (PRODUCT.md §7.23)', () => {
  it('sends the request, keeps the request token as this session\'s token, and waits (polling the request, not /api/me)', async () => {
    const { ctrl, gateway, tokens } = make();
    await ctrl.requestRejoin(1, 'Phi 2', '123456', 'phi78@gmail.com');
    expect(gateway.requestRejoin).toHaveBeenCalledWith(1, { displayName: 'Phi 2', roomCode: '123456', email: 'phi78@gmail.com' });
    expect(tokens.getToken(1)).toBe('req-tok');
    expect(tokens.getCurrentSessionId()).toBe('1');
    expect(selectScreen(ctrl.getState())).toBe('rejoin');
    expect(ctrl.getState().rejoin).toBe('pending');
    const meCalls = (gateway.getMe as ReturnType<typeof vi.fn>).mock.calls.length;
    const stop = ctrl.start();
    await vi.advanceTimersByTimeAsync(2000);
    stop();
    expect(gateway.getRejoinStatus).toHaveBeenCalled();
    expect((gateway.getMe as ReturnType<typeof vi.fn>).mock.calls.length).toBe(meCalls); // /api/me with a request token would be a 401
  });

  it('approved by the mentor: the same token now is the member\'s, and the member state loads', async () => {
    let status: 'pending' | 'approved' = 'pending';
    const { ctrl, gateway } = make({ getRejoinStatus: async () => ({ status, sessionId: 1 }) });
    await ctrl.requestRejoin(1, 'Phi', '123456', 'phi78@gmail.com');
    expect(selectScreen(ctrl.getState())).toBe('rejoin');
    status = 'approved';
    await ctrl.fetchRejoin();
    await settle();
    expect(ctrl.getState().rejoin).toBeNull();
    expect(gateway.getMe).toHaveBeenCalled();
    expect(selectScreen(ctrl.getState())).toBe('lobby');
  });

  it('the mentor had allowed it beforehand: approved at once, straight into the session', async () => {
    const { ctrl, tokens } = make({ requestRejoin: async () => ({ requestId: null, token: 'back-tok', status: 'approved' as const }) });
    await ctrl.requestRejoin(1, 'Phi', '123456', 'phi78@gmail.com');
    await settle();
    expect(tokens.getToken(1)).toBe('back-tok');
    expect(ctrl.getState().rejoin).toBeNull();
    expect(selectScreen(ctrl.getState())).toBe('lobby');
  });

  it('rejected and expired are shown as such; going back to the form drops the request token but keeps the looked-up room', async () => {
    for (const answer of ['rejected', 'expired'] as const) {
      const { ctrl, tokens } = make({ getRejoinStatus: async () => ({ status: answer, sessionId: 1 }) });
      await ctrl.lookUpRoom('123456');
      await ctrl.requestRejoin(1, 'Phi', '123456', 'phi78@gmail.com');
      expect(ctrl.getState().rejoin).toBe(answer);
      expect(selectScreen(ctrl.getState())).toBe('rejoin');
      ctrl.backFromRejoin();
      expect(tokens.getToken(1)).toBeNull();
      expect(selectScreen(ctrl.getState())).toBe('join'); // the form again, room still known
    }
  });

  it('withdrawing tells the server, then returns to the form even if the server cannot be reached', async () => {
    const { ctrl, gateway } = make({ cancelRejoin: vi.fn(async () => { throw new ApiError(0, 'down'); }) });
    await ctrl.requestRejoin(1, 'Phi', '123456', 'a@x.com');
    await ctrl.cancelRejoin();
    expect(gateway.cancelRejoin).toHaveBeenCalled();
    expect(ctrl.getState().rejoin).toBeNull();
    expect(selectScreen(ctrl.getState())).toBe('code');
  });

  it('losing the connection keeps the request and says so; a forgotten request (404) returns to the form', async () => {
    let mode: 'down' | 'gone' | 'ok' = 'down';
    const { ctrl } = make({ getRejoinStatus: async () => { if (mode === 'down') throw new ApiError(0, 'down'); if (mode === 'gone') throw new ApiError(404, 'x'); return { status: 'pending' as const, sessionId: 1 }; } });
    await ctrl.requestRejoin(1, 'Phi', '123456', 'a@x.com');
    expect(ctrl.getState()).toMatchObject({ rejoin: 'pending', rejoinOffline: true });
    mode = 'ok';
    await ctrl.fetchRejoin();
    expect(ctrl.getState().rejoinOffline).toBe(false);
    mode = 'gone';
    await ctrl.fetchRejoin();
    expect(ctrl.getState().rejoin).toBeNull();
    expect(selectScreen(ctrl.getState())).toBe('code');
  });

  it('403 "replaced" (the mentor let this person in on another device) is its own screen, not "kicked"', async () => {
    const { ctrl } = make({ getMe: async () => { throw new ApiError(403, 'Bài của bạn đang được mở ở thiết bị khác', 'replaced'); } }, inSession());
    await settle();
    expect(selectScreen(ctrl.getState())).toBe('replaced');
    ctrl.leave();
    expect(selectScreen(ctrl.getState())).toBe('code');
  });
});
