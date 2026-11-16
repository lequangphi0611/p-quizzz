import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSession, MeResponse } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { InMemoryTokenStore } from '../../../shared/token-store/in-memory-token-store.js';
import type { MemberGateway, RoomCodeMemory } from './member-gateway.js';
import { MemberHomeController, selectActiveId, selectScreen } from './member-home-controller.js';

const active = (id = 1, status: ActiveSession['status'] = 'lobby'): ActiveSession => ({ id, title: 'T', status } as ActiveSession);
const me = (id = 1, status = 'lobby', participant = 'active', attemptCurrent: unknown = null): MeResponse => ({ session: { id, status, title: 'T' }, participant: { status: participant, displayName: 'An' }, attempt: { current: attemptCurrent, submitted: [] } } as unknown as MeResponse);

function make(over: Partial<MemberGateway> = {}, tokens = new InMemoryTokenStore()) {
  const memory = new Map<number, string>();
  const rooms: RoomCodeMemory = { remember: (id, c) => void memory.set(id, c), recall: id => memory.get(id) ?? '' };
  const gateway: MemberGateway = { getActive: vi.fn(async () => active()), getMe: vi.fn(async () => me()), join: vi.fn(async () => ({ token: 'tok' }) as never), ...over };
  return { gateway, tokens, rooms, ctrl: new MemberHomeController(gateway, tokens, rooms, 1000) };
}
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('MemberHomeController', () => {
  it('loading → join when there is an active session and no token', async () => {
    const { ctrl } = make();
    expect(selectScreen(ctrl.getState())).toBe('loading');
    await ctrl.fetchActive();
    await settle();
    expect(selectScreen(ctrl.getState())).toBe('join');
  });

  it('shows "none" when nothing is active and this browser has no token', async () => {
    const { ctrl } = make({ getActive: async () => null });
    await ctrl.fetchActive();
    expect(selectScreen(ctrl.getState())).toBe('none');
  });

  it('with a token it loads the member state and shows the lobby', async () => {
    const t = new InMemoryTokenStore(); t.setToken(1, 'tok'); t.setCurrentSessionId(1);
    const { ctrl, gateway } = make({}, t);
    await ctrl.fetchActive();
    await settle();
    expect(gateway.getMe).toHaveBeenCalled();
    expect(selectScreen(ctrl.getState())).toBe('lobby');
  });

  it('keeps following the remembered session after it stops being active (result stays on screen)', async () => {
    const t = new InMemoryTokenStore(); t.setToken(1, 'tok'); t.setCurrentSessionId(1);
    const { ctrl } = make({ getActive: async () => null, getMe: async () => me(1, 'closed') }, t);
    expect(selectActiveId(ctrl.getState())).toBeNull(); // active still unknown
    await ctrl.fetchActive();
    await settle();
    expect(selectActiveId(ctrl.getState())).toBe(1);
    expect(selectScreen(ctrl.getState())).toBe('ended');
  });

  it('401 (unknown token, e.g. DB reset): forgets the token and starts over', async () => {
    const t = new InMemoryTokenStore(); t.setToken(1, 'old'); t.setCurrentSessionId(1);
    const { ctrl } = make({ getMe: async () => { throw new ApiError(401, 'x'); } }, t);
    await ctrl.fetchActive();
    await settle();
    expect(t.getToken(1)).toBeNull();
    expect(selectScreen(ctrl.getState())).toBe('join');
  });

  it('403 means kicked; leaveKicked clears the token and returns to the join form', async () => {
    const t = new InMemoryTokenStore(); t.setToken(1, 'tok'); t.setCurrentSessionId(1);
    const { ctrl } = make({ getMe: async () => { throw new ApiError(403, 'x'); } }, t);
    await ctrl.fetchActive();
    await settle();
    expect(selectScreen(ctrl.getState())).toBe('kicked');
    ctrl.leaveKicked();
    expect(t.getToken(1)).toBeNull();
    expect(selectScreen(ctrl.getState())).toBe('join');
  });

  it('a network error on the first member load shows the error screen, but never replaces a state we already have', async () => {
    const t = new InMemoryTokenStore(); t.setToken(1, 'tok'); t.setCurrentSessionId(1);
    let fail = true;
    const { ctrl } = make({ getMe: async () => { if (fail) throw new ApiError(0, 'down'); return me(); } }, t);
    await ctrl.fetchActive();
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
    await ctrl.fetchActive();
    await ctrl.join(1, 'An', '123456');
    expect(gateway.join).toHaveBeenCalledWith(1, { displayName: 'An', roomCode: '123456' });
    expect(tokens.getToken(1)).toBe('tok');
    expect(tokens.getCurrentSessionId()).toBe('1');
    expect(rooms.recall(1)).toBe('123456');
    await ctrl.joined(1);
    expect(selectScreen(ctrl.getState())).toBe('lobby');
  });

  it('a failed join leaves nothing stored and rejects for the form', async () => {
    const { ctrl, tokens } = make({ join: async () => { throw new ApiError(403, 'Mã phòng không đúng'); } });
    await expect(ctrl.join(1, 'An', '000000')).rejects.toThrow('Mã phòng không đúng');
    expect(tokens.getToken(1)).toBeNull();
  });

  it('polls on an interval until stopped', async () => {
    const { ctrl, gateway } = make();
    const stop = ctrl.start();
    await settle();
    expect(gateway.getActive).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(gateway.getActive).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(3000);
    expect(gateway.getActive).toHaveBeenCalledTimes(3);
  });

  it('notices the auto-submit when the session closes under a working member', async () => {
    const t = new InMemoryTokenStore(); t.setToken(1, 'tok'); t.setCurrentSessionId(1);
    let status = 'running';
    const { ctrl } = make({ getActive: async () => active(1, status as never), getMe: async () => me(1, status, 'active', status === 'running' ? { id: 9 } : null) }, t);
    await ctrl.fetchActive();
    await settle();
    expect(selectScreen(ctrl.getState())).toBe('running');
    expect(ctrl.getState().autoSubmitted).toBe(false);
    status = 'closed';
    await ctrl.fetchActive();
    await ctrl.refreshMe();
    expect(selectScreen(ctrl.getState())).toBe('ended');
    expect(ctrl.getState().autoSubmitted).toBe(true);
  });
});
