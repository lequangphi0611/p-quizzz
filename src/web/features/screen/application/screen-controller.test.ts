import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSession, LeaderboardResponse } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { ScreenController } from './screen-controller.js';
import type { ScreenGateway } from './screen-gateway.js';

const sess = (id: number, status = 'lobby'): ActiveSession => ({ id, title: `T${id}`, status } as ActiveSession);
const board = { entries: [], provisional: true } as unknown as LeaderboardResponse;
function make(over: Partial<ScreenGateway> = {}, sessionId = 1) {
  const gateway: ScreenGateway = {
    getSession: vi.fn(async id => sess(id)),
    listSessions: vi.fn(async () => ({ open: [], latestEnded: null })),
    getParticipants: vi.fn(async () => [{ displayName: 'An' }, { displayName: 'Bình' }] as never),
    getLeaderboard: vi.fn(async () => board),
    getRosterCounts: vi.fn(async () => null),
    getRoom: vi.fn(async () => ({ roomCode: '123456' }) as never),
    getJoinHosts: vi.fn(async () => []),
    ...over,
  };
  return { gateway, ctrl: new ScreenController(gateway, sessionId, 1000) };
}
const settle = () => vi.advanceTimersByTimeAsync(0);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('ScreenController (one session per address)', () => {
  it('loads the session in the address, then its names, ranking and room code', async () => {
    const { ctrl, gateway } = make({}, 7);
    ctrl.start();
    await settle();
    expect(ctrl.getState()).toMatchObject({ names: ['An', 'Bình'], board, roomCode: '123456', roomHidden: false });
    expect(ctrl.getState().session?.id).toBe(7);
    expect(gateway.getParticipants).toHaveBeenCalledWith(7);
    expect(gateway.getRoom).toHaveBeenCalledWith(7); // each session asks for ITS room code
  });

  it('a session limited to a list also shows how many of it have joined (numbers only)', async () => {
    const { ctrl, gateway } = make({ getRosterCounts: async () => ({ joinedCount: 5, rosterSize: 6 }) });
    ctrl.start();
    await settle();
    expect(ctrl.getState().roster).toEqual({ joinedCount: 5, rosterSize: 6 });
    expect(gateway.getParticipants).toHaveBeenCalledWith(1);
  });

  it('a session that does not exist is null', async () => {
    const { ctrl } = make({ getSession: async () => { throw new ApiError(404, 'x'); } });
    await ctrl.fetchSession();
    expect(ctrl.getState().session).toBeNull();
  });

  it('hides the room code on a machine that is not the mentor\'s (403)', async () => {
    const { ctrl } = make({ getRoom: async () => { throw new ApiError(403, 'x'); } });
    ctrl.start();
    await settle();
    expect(ctrl.getState()).toMatchObject({ roomCode: null, roomHidden: true });
  });

  it('keeps what it shows when a poll fails', async () => {
    let fail = false;
    const { ctrl } = make({ getSession: async () => { if (fail) throw new Error('down'); return sess(1); } });
    await ctrl.fetchSession(); await ctrl.fetchData();
    fail = true;
    await ctrl.fetchSession();
    expect(ctrl.getState().session?.id).toBe(1);
    expect(ctrl.getState().names).toHaveLength(2);
  });

  it('polls until stopped', async () => {
    const { ctrl, gateway } = make();
    const stop = ctrl.start();
    await settle();
    await vi.advanceTimersByTimeAsync(2000);
    expect((gateway.getSession as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect((gateway.getSession as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);
  });
});
