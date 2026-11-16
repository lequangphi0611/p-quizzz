import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSession, LeaderboardResponse } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { ScreenController } from './screen-controller.js';
import type { ScreenGateway } from './screen-gateway.js';

const sess = (id: number, status = 'lobby'): ActiveSession => ({ id, title: `T${id}`, status } as ActiveSession);
const board = { entries: [], provisional: true } as unknown as LeaderboardResponse;
function make(over: Partial<ScreenGateway> = {}) {
  const gateway: ScreenGateway = {
    getLatest: vi.fn(async () => sess(1)),
    getParticipants: vi.fn(async () => [{ displayName: 'An' }, { displayName: 'Bình' }] as never),
    getLeaderboard: vi.fn(async () => board),
    getRoom: vi.fn(async () => ({ roomCode: '123456' }) as never),
    getJoinHosts: vi.fn(async () => []),
    ...over,
  };
  return { gateway, ctrl: new ScreenController(gateway, 1000) };
}
const settle = () => vi.advanceTimersByTimeAsync(0);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('ScreenController', () => {
  it('loads the latest session, then its names, ranking and room code', async () => {
    const { ctrl } = make();
    await ctrl.fetchLatest();
    await settle();
    expect(ctrl.getState()).toMatchObject({ names: ['An', 'Bình'], board, roomCode: '123456', roomHidden: false });
    expect(ctrl.getState().latest?.id).toBe(1);
  });

  it('shows "no session" as null', async () => {
    const { ctrl, gateway } = make({ getLatest: async () => null });
    await ctrl.fetchLatest();
    expect(ctrl.getState().latest).toBeNull();
    expect(gateway.getParticipants).not.toHaveBeenCalled();
  });

  it('hides the room code on a machine that is not the mentor\'s (403)', async () => {
    const { ctrl } = make({ getRoom: async () => { throw new ApiError(403, 'x'); } });
    await ctrl.fetchLatest();
    await settle();
    expect(ctrl.getState()).toMatchObject({ roomCode: null, roomHidden: true });
  });

  it('switches by itself when the mentor opens the next session, dropping the old data', async () => {
    let latest = sess(1);
    const { ctrl } = make({ getLatest: async () => latest, getParticipants: async id => [{ displayName: `p${id}` }] as never });
    await ctrl.fetchLatest(); await settle();
    expect(ctrl.getState().names).toEqual(['p1']);
    latest = sess(2);
    await ctrl.fetchLatest(); await settle();
    expect(ctrl.getState().latest?.id).toBe(2);
    expect(ctrl.getState().names).toEqual(['p2']);
  });

  it('keeps what it shows when a poll fails', async () => {
    let fail = false;
    const { ctrl } = make({ getLatest: async () => { if (fail) throw new Error('down'); return sess(1); } });
    await ctrl.fetchLatest(); await settle();
    fail = true;
    await ctrl.fetchLatest();
    expect(ctrl.getState().latest?.id).toBe(1);
    expect(ctrl.getState().names).toHaveLength(2);
  });

  it('polls until stopped', async () => {
    const { ctrl, gateway } = make();
    const stop = ctrl.start();
    await settle();
    await vi.advanceTimersByTimeAsync(2000);
    expect((gateway.getLatest as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect((gateway.getLatest as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);
  });
});
