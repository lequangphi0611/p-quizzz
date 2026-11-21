import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyTraining, ResolvedRoom } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { FAST_POLL_MS, SLOW_POLL_MS } from '../domain/timing.js';
import { TrainingMemberController, selectCheckSecondsLeft, selectScreen, selectWaitingHint } from './training-member-controller.js';
import type { TrainingMemberGateway, TrainingTokenStore } from './training-member-gateway.js';

const ID = 7;
const CODE = '482913';

const me = (status: MyTraining['training']['status'] = 'open', connection: MyTraining['member']['connection'] = 'waiting', uninstallCheck: MyTraining['member']['uninstallCheck'] = 'none'): MyTraining => ({
  training: { id: ID, name: 'Claude Code buổi 2', status },
  member: { displayName: 'An', connection, uninstallCheck },
});
const hookConfig = { settings: { hooks: {} } as never, mergePrompt: 'Hãy ghép…' };

class FakeTokens implements TrainingTokenStore {
  map = new Map<number, string>();
  get = (id: number) => this.map.get(id) ?? null;
  set = (id: number, t: string) => void this.map.set(id, t);
  clear = (id: number) => void this.map.delete(id);
}

function make(over: Partial<TrainingMemberGateway> = {}, opts: { token?: string; code?: string; hidden?: () => boolean } = {}) {
  const tokens = new FakeTokens();
  if (opts.token) tokens.set(ID, opts.token);
  const gateway: TrainingMemberGateway = {
    resolveRoom: vi.fn(async (): Promise<ResolvedRoom> => ({ kind: 'training', id: ID, title: 'Claude Code buổi 2' })),
    join: vi.fn(async () => ({ token: 'tok-new', member: { displayName: 'An' } })),
    me: vi.fn(async () => me()),
    hookConfig: vi.fn(async () => hookConfig),
    startUninstallCheck: vi.fn(async () => {}),
    finishUninstallCheck: vi.fn(async () => ({ result: 'passed' as const })),
    withdraw: vi.fn(async () => {}),
    ...over,
  };
  const ctrl = new TrainingMemberController({ gateway, tokens, isHidden: opts.hidden ?? (() => false) }, ID, opts.code ?? CODE);
  return { ctrl, gateway, tokens };
}
const settle = () => vi.advanceTimersByTimeAsync(0);
const screen = (c: TrainingMemberController) => selectScreen(c.getState());

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('TrainingMemberController: before joining', () => {
  it('no token: looks the room code up, then asks for a name and consent (the title comes from the lookup)', async () => {
    const { ctrl, gateway } = make();
    expect(screen(ctrl)).toBe('loading');
    ctrl.start();
    await settle();
    expect(gateway.resolveRoom).toHaveBeenCalledWith(CODE);
    expect(screen(ctrl)).toBe('consent');
    expect(ctrl.getState().room.title).toBe('Claude Code buổi 2');
    expect(gateway.me).not.toHaveBeenCalled();
  });

  it('does not look the code up twice (React StrictMode starts twice; every wrong code counts at the server)', async () => {
    const { ctrl, gateway } = make();
    ctrl.start();
    ctrl.start();
    await settle();
    expect(gateway.resolveRoom).toHaveBeenCalledTimes(1);
  });

  it('no code in the address: nothing to join with, so a "lost" screen instead of a form, and no request', async () => {
    const { ctrl, gateway } = make({}, { code: '' });
    ctrl.start();
    await settle();
    expect(screen(ctrl)).toBe('lost');
    expect(gateway.resolveRoom).not.toHaveBeenCalled();
    expect(await ctrl.join('An', true)).toBe(false);
  });

  it('a malformed code counts as no code', async () => {
    const { ctrl, gateway } = make({}, { code: '12ab' });
    ctrl.start();
    await settle();
    expect(screen(ctrl)).toBe('lost');
    expect(gateway.resolveRoom).not.toHaveBeenCalled();
  });

  it('a wrong code or a stopped training is "lost" and is not asked again', async () => {
    const { ctrl, gateway } = make({ resolveRoom: vi.fn(async () => { throw new ApiError(403, 'Mã phòng không đúng'); }) });
    ctrl.start();
    await settle();
    expect(screen(ctrl)).toBe('lost');
    await ctrl.refresh();
    expect(gateway.resolveRoom).toHaveBeenCalledTimes(1);
  });

  it('a code that opens another training (or an exam session) is "lost" here', async () => {
    const { ctrl } = make({ resolveRoom: vi.fn(async (): Promise<ResolvedRoom> => ({ kind: 'training', id: 99, title: 'Khác' })) });
    ctrl.start();
    await settle();
    expect(screen(ctrl)).toBe('lost');
  });

  it('cannot reach the mentor machine: offline, and the lookup is retried by itself until it works', async () => {
    let n = 0;
    const { ctrl, gateway } = make({ resolveRoom: vi.fn(async (): Promise<ResolvedRoom> => { if (n++ < 2) throw new ApiError(0, 'Không kết nối được tới máy chủ'); return { kind: 'training', id: ID, title: 'T' }; }) });
    ctrl.start();
    await settle();
    expect(screen(ctrl)).toBe('offline');
    await vi.advanceTimersByTimeAsync(FAST_POLL_MS);
    expect(screen(ctrl)).toBe('offline'); // no flicker through "loading" while it retries
    await vi.advanceTimersByTimeAsync(FAST_POLL_MS);
    expect(gateway.resolveRoom).toHaveBeenCalledTimes(3);
    expect(screen(ctrl)).toBe('consent');
  });
});

describe('TrainingMemberController: joining with consent', () => {
  async function atConsent(over: Partial<TrainingMemberGateway> = {}) {
    const made = make(over);
    made.ctrl.start();
    await settle();
    return made;
  }

  it('without consent nothing is sent', async () => {
    const { ctrl, gateway, tokens } = await atConsent();
    expect(await ctrl.join('An', false)).toBe(false);
    expect(gateway.join).not.toHaveBeenCalled();
    expect(tokens.get(ID)).toBeNull();
    expect(screen(ctrl)).toBe('consent');
  });

  it('an empty name sends nothing either', async () => {
    const { ctrl, gateway } = await atConsent();
    expect(await ctrl.join('   ', true)).toBe(false);
    expect(gateway.join).not.toHaveBeenCalled();
  });

  it('joins with the trimmed name and the room code from the address, keeps the token and moves to the install screen', async () => {
    const { ctrl, gateway, tokens } = await atConsent();
    expect(await ctrl.join('  An  ', true)).toBe(true);
    expect(gateway.join).toHaveBeenCalledWith(ID, { displayName: 'An', roomCode: CODE });
    expect(tokens.get(ID)).toBe('tok-new');
    expect(gateway.me).toHaveBeenCalledWith('tok-new');
    expect(screen(ctrl)).toBe('install');
  });

  it('a name that is taken (409 identity_in_use) says so, keeps the form and stores no token', async () => {
    const { ctrl, tokens } = await atConsent({ join: vi.fn(async () => { throw new ApiError(409, 'Tên đã có người dùng', 'identity_in_use'); }) });
    expect(await ctrl.join('An', true)).toBe(false);
    expect(ctrl.getState().join).toEqual({ busy: false, error: expect.objectContaining({ kind: 'taken' }) });
    expect(screen(ctrl)).toBe('consent');
    expect(tokens.get(ID)).toBeNull();
  });

  it('too many wrong codes (429): the form stays, with the wait', async () => {
    const { ctrl } = await atConsent({ join: vi.fn(async () => { throw new ApiError(429, 'Nhập sai mã phòng quá nhiều lần. Thử lại sau 42 giây'); }) });
    await ctrl.join('An', true);
    expect(ctrl.getState().join.error).toEqual({ kind: 'locked', seconds: 42 });
    expect(screen(ctrl)).toBe('consent');
  });

  it('a training that stopped under the member (403) is "lost", not a name problem', async () => {
    const { ctrl } = await atConsent({ join: vi.fn(async () => { throw new ApiError(403, 'Mã phòng không đúng'); }) });
    await ctrl.join('An', true);
    expect(screen(ctrl)).toBe('lost');
  });

  it('no connection while joining keeps the form with a message', async () => {
    const { ctrl } = await atConsent({ join: vi.fn(async () => { throw new ApiError(0, 'Không kết nối được tới máy chủ'); }) });
    await ctrl.join('An', true);
    expect(ctrl.getState().join.error).toMatchObject({ kind: 'offline' });
    expect(screen(ctrl)).toBe('consent');
  });

  it('a second click while joining sends one request', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>(r => { release = r; });
    const { ctrl, gateway } = await atConsent({ join: vi.fn(async () => { await gate; return { token: 'tok-new', member: { displayName: 'An' } }; }) });
    const first = ctrl.join('An', true);
    expect(await ctrl.join('An', true)).toBe(false);
    release();
    await first;
    expect(gateway.join).toHaveBeenCalledTimes(1);
  });
});

describe('TrainingMemberController: with a token (resuming)', () => {
  it('reads the token from the store, asks `me` and never looks the room code up', async () => {
    const { ctrl, gateway } = make({}, { token: 'tok' });
    expect(screen(ctrl)).toBe('loading');
    ctrl.start();
    await settle();
    expect(gateway.me).toHaveBeenCalledWith('tok');
    expect(gateway.resolveRoom).not.toHaveBeenCalled();
    expect(screen(ctrl)).toBe('install');
  });

  it('works with no room code in the address at all (a reload after joining)', async () => {
    const { ctrl } = make({ me: vi.fn(async () => me('open', 'connected')) }, { token: 'tok', code: '' });
    ctrl.start();
    await settle();
    expect(screen(ctrl)).toBe('recording');
  });

  it('401: the token is cleared and the member sees the ended screen (no retry, no more polling)', async () => {
    const { ctrl, gateway, tokens } = make({ me: vi.fn(async () => { throw new ApiError(401, 'Bạn chưa vào buổi training'); }) }, { token: 'tok' });
    ctrl.start();
    await settle();
    expect(screen(ctrl)).toBe('ended');
    expect(tokens.get(ID)).toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(gateway.me).toHaveBeenCalledTimes(1);
  });
});

describe('TrainingMemberController: polling', () => {
  it('asks every 3 seconds while waiting for the first signal, and moves to "Đã nhận tín hiệu" when it arrives', async () => {
    let connection: MyTraining['member']['connection'] = 'waiting';
    const { ctrl, gateway } = make({ me: vi.fn(async () => me('open', connection)) }, { token: 'tok' });
    ctrl.start();
    await settle();
    expect(gateway.me).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(FAST_POLL_MS);
    expect(gateway.me).toHaveBeenCalledTimes(2);
    connection = 'connected';
    await vi.advanceTimersByTimeAsync(FAST_POLL_MS);
    expect(screen(ctrl)).toBe('recording');
  });

  it('once recording it polls slowly: only "Dừng thu" and "Kết thúc" are waited for', async () => {
    const { ctrl, gateway } = make({ me: vi.fn(async () => me('open', 'connected')) }, { token: 'tok' });
    ctrl.start();
    await settle();
    vi.mocked(gateway.me).mockClear();
    await vi.advanceTimersByTimeAsync(FAST_POLL_MS * 3);
    expect(gateway.me).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SLOW_POLL_MS);
    expect(gateway.me).toHaveBeenCalledTimes(1);
  });

  it('notices the mentor stopping while the "recording" screen is up, and moves to the removal steps', async () => {
    let status: MyTraining['training']['status'] = 'open';
    const { ctrl } = make({ me: vi.fn(async () => me(status, 'connected')) }, { token: 'tok' });
    ctrl.start();
    await settle();
    expect(screen(ctrl)).toBe('recording');
    status = 'stopped';
    await vi.advanceTimersByTimeAsync(SLOW_POLL_MS);
    expect(screen(ctrl)).toBe('remove');
  });

  it('a hidden tab does not poll; refresh() (called when the tab is shown again) catches up at once', async () => {
    let hidden = true;
    const { ctrl, gateway } = make({}, { token: 'tok', hidden: () => hidden });
    ctrl.start();
    await settle();
    vi.mocked(gateway.me).mockClear();
    await vi.advanceTimersByTimeAsync(FAST_POLL_MS * 5);
    expect(gateway.me).not.toHaveBeenCalled();
    hidden = false;
    await ctrl.refresh();
    expect(gateway.me).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(FAST_POLL_MS);
    expect(gateway.me).toHaveBeenCalledTimes(2); // and the 3-second rhythm resumes
  });

  it('the stop function ends the polling', async () => {
    const { ctrl, gateway } = make({}, { token: 'tok' });
    const stop = ctrl.start();
    await settle();
    stop();
    vi.mocked(gateway.me).mockClear();
    await vi.advanceTimersByTimeAsync(FAST_POLL_MS * 5);
    expect(gateway.me).not.toHaveBeenCalled();
  });

  it('losing the mentor machine keeps the screen, flags it, retries every 3 seconds and clears the flag when it is back', async () => {
    let up = true;
    const { ctrl, gateway } = make({ me: vi.fn(async () => { if (!up) throw new ApiError(0, 'Không kết nối được tới máy chủ'); return me('open', 'connected'); }) }, { token: 'tok' });
    ctrl.start();
    await settle();
    expect(screen(ctrl)).toBe('recording');
    up = false;
    await vi.advanceTimersByTimeAsync(SLOW_POLL_MS);
    expect(ctrl.getState().offline).toBe(true);
    expect(screen(ctrl)).toBe('recording'); // what is known stays; the page adds a banner
    vi.mocked(gateway.me).mockClear();
    await vi.advanceTimersByTimeAsync(FAST_POLL_MS * 2);
    expect(gateway.me).toHaveBeenCalledTimes(2);
    up = true;
    await vi.advanceTimersByTimeAsync(FAST_POLL_MS);
    expect(ctrl.getState().offline).toBe(false);
  });

  it('with nothing known yet, an unreachable mentor machine is the offline screen', async () => {
    const { ctrl } = make({ me: vi.fn(async () => { throw new ApiError(0, 'Không kết nối được tới máy chủ'); }) }, { token: 'tok' });
    ctrl.start();
    await settle();
    expect(screen(ctrl)).toBe('offline');
    expect(ctrl.getState().token).toBe('tok'); // the token is kept: this is not "ended"
  });
});

describe('TrainingMemberController: the install screen', () => {
  it('loads the member\'s own hook config once, while the install screen is up', async () => {
    const { ctrl, gateway } = make({}, { token: 'tok' });
    ctrl.start();
    await settle();
    await vi.advanceTimersByTimeAsync(FAST_POLL_MS * 3);
    expect(gateway.hookConfig).toHaveBeenCalledTimes(1);
    expect(gateway.hookConfig).toHaveBeenCalledWith('tok');
    expect(ctrl.getState().hookConfig).toEqual({ status: 'ok', value: hookConfig });
  });

  it('does not load it while recording or after the stop', async () => {
    const { ctrl, gateway } = make({ me: vi.fn(async () => me('open', 'connected')) }, { token: 'tok' });
    ctrl.start();
    await settle();
    expect(gateway.hookConfig).not.toHaveBeenCalled();
  });

  it('a config that could not load can be retried, and is retried when the server answers again', async () => {
    let fail = true;
    const { ctrl, gateway } = make({ hookConfig: vi.fn(async () => { if (fail) throw new ApiError(0, 'Không kết nối được tới máy chủ'); return hookConfig; }) }, { token: 'tok' });
    ctrl.start();
    await settle();
    expect(ctrl.getState().hookConfig.status).toBe('error');
    fail = false;
    ctrl.retryHookConfig();
    await settle();
    expect(ctrl.getState().hookConfig.status).toBe('ok');
    expect(gateway.hookConfig).toHaveBeenCalledTimes(2);
  });

  it('a config that failed offline is tried again by the next poll', async () => {
    let fail = true;
    const { ctrl } = make({ hookConfig: vi.fn(async () => { if (fail) throw new ApiError(0, 'x'); return hookConfig; }) }, { token: 'tok' });
    ctrl.start();
    await settle();
    expect(ctrl.getState().hookConfig.status).toBe('error');
    fail = false;
    await vi.advanceTimersByTimeAsync(FAST_POLL_MS);
    expect(ctrl.getState().hookConfig.status).toBe('ok');
  });

  it('a config refused because the training is no longer open (409) moves on to the removal steps', async () => {
    let status: MyTraining['training']['status'] = 'open';
    const { ctrl } = make({
      me: vi.fn(async () => me(status, 'waiting')),
      hookConfig: vi.fn(async () => { status = 'stopped'; throw new ApiError(409, 'Buổi training không còn thu nữa'); }),
    }, { token: 'tok' });
    ctrl.start();
    await settle();
    expect(screen(ctrl)).toBe('remove');
  });

  it('the "maybe check this" hint appears after about a minute without a signal, and never after one arrives', async () => {
    let connection: MyTraining['member']['connection'] = 'waiting';
    const { ctrl } = make({ me: vi.fn(async () => me('open', connection)) }, { token: 'tok' });
    const t0 = Date.now();
    ctrl.start();
    await settle();
    expect(selectWaitingHint(ctrl.getState(), t0 + 59_000)).toBe(false);
    expect(selectWaitingHint(ctrl.getState(), t0 + 60_000)).toBe(true);
    connection = 'connected';
    await vi.advanceTimersByTimeAsync(FAST_POLL_MS);
    expect(selectWaitingHint(ctrl.getState(), t0 + 120_000)).toBe(false);
  });
});

describe('TrainingMemberController: withdrawing consent', () => {
  it('deletes on the server, forgets the token and reports done (the page then goes to the first page)', async () => {
    const { ctrl, gateway, tokens } = make({}, { token: 'tok' });
    ctrl.start();
    await settle();
    expect(await ctrl.withdraw()).toBe(true);
    expect(gateway.withdraw).toHaveBeenCalledWith('tok');
    expect(tokens.get(ID)).toBeNull();
    expect(ctrl.getState().token).toBeNull();
  });

  it('a mentor machine that cannot be reached leaves everything as it was, and says so', async () => {
    const { ctrl, tokens } = make({ withdraw: vi.fn(async () => { throw new ApiError(0, 'x'); }) }, { token: 'tok' });
    ctrl.start();
    await settle();
    expect(await ctrl.withdraw()).toBe(false);
    expect(tokens.get(ID)).toBe('tok');
    expect(ctrl.getState().withdraw.error).toMatch(/Thử lại/);
    ctrl.clearWithdrawError();
    expect(ctrl.getState().withdraw.error).toBeNull();
  });

  it('401 (already gone) still counts as withdrawn', async () => {
    const { ctrl, tokens } = make({ withdraw: vi.fn(async () => { throw new ApiError(401, 'x'); }) }, { token: 'tok' });
    ctrl.start();
    await settle();
    expect(await ctrl.withdraw()).toBe(true);
    expect(tokens.get(ID)).toBeNull();
  });

  it('is not possible without a token', async () => {
    const { ctrl, gateway } = make();
    expect(await ctrl.withdraw()).toBe(false);
    expect(gateway.withdraw).not.toHaveBeenCalled();
  });
});

describe('TrainingMemberController: the removal check', () => {
  const stopped = (uninstallCheck: MyTraining['member']['uninstallCheck'] = 'none') => vi.fn(async () => me('stopped', 'connected', uninstallCheck));

  async function atRemove(over: Partial<TrainingMemberGateway> = {}) {
    const made = make({ me: stopped(), ...over }, { token: 'tok' });
    made.ctrl.start();
    await settle();
    expect(screen(made.ctrl)).toBe('remove');
    return made;
  }

  it('"Kiểm tra đã gỡ" starts it on the server and moves to the check screen with a 5-second lock on "Xong"', async () => {
    const { ctrl, gateway } = await atRemove();
    await ctrl.startCheck();
    expect(gateway.startUninstallCheck).toHaveBeenCalledWith('tok');
    expect(screen(ctrl)).toBe('check');
    const now = Date.now();
    expect(selectCheckSecondsLeft(ctrl.getState(), now)).toBe(5);
    expect(selectCheckSecondsLeft(ctrl.getState(), now + 2_000)).toBe(3);
  });

  it('"Xong" does nothing until the 5 seconds are over', async () => {
    const { ctrl, gateway } = await atRemove();
    await ctrl.startCheck();
    await ctrl.finishCheck();
    expect(gateway.finishUninstallCheck).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4_900);
    await ctrl.finishCheck();
    expect(gateway.finishUninstallCheck).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    await ctrl.finishCheck();
    expect(gateway.finishUninstallCheck).toHaveBeenCalledTimes(1);
  });

  it('passed: "Đã gỡ"', async () => {
    const { ctrl } = await atRemove();
    await ctrl.startCheck();
    await vi.advanceTimersByTimeAsync(5_000);
    await ctrl.finishCheck();
    expect(screen(ctrl)).toBe('removed');
    expect(ctrl.getState().check.result).toBe('passed');
  });

  it('failed: still receiving; it can be run again, and the second run starts from a clean slate', async () => {
    const results: ('failed' | 'passed')[] = ['failed', 'passed'];
    const { ctrl, gateway } = await atRemove({ finishUninstallCheck: vi.fn(async () => ({ result: results.shift()! })) });
    await ctrl.startCheck();
    await vi.advanceTimersByTimeAsync(5_000);
    await ctrl.finishCheck();
    expect(screen(ctrl)).toBe('check-failed');
    await ctrl.startCheck();
    expect(gateway.startUninstallCheck).toHaveBeenCalledTimes(2);
    expect(screen(ctrl)).toBe('check');
    expect(ctrl.getState().check.result).toBeNull();
    expect(selectCheckSecondsLeft(ctrl.getState(), Date.now())).toBe(5);
    await vi.advanceTimersByTimeAsync(5_000);
    await ctrl.finishCheck();
    expect(screen(ctrl)).toBe('removed');
  });

  it('a too-early answer (409 too_early) waits a little more instead of failing', async () => {
    let early = true;
    const { ctrl, gateway } = await atRemove({ finishUninstallCheck: vi.fn(async () => { if (early) { early = false; throw new ApiError(409, 'Chờ thêm vài giây', 'too_early'); } return { result: 'passed' as const }; }) });
    await ctrl.startCheck();
    await vi.advanceTimersByTimeAsync(5_000);
    await ctrl.finishCheck();
    expect(screen(ctrl)).toBe('check');
    expect(ctrl.getState().check.message).toMatch(/Chờ thêm/);
    expect(selectCheckSecondsLeft(ctrl.getState(), Date.now())).toBeGreaterThan(0);
    await ctrl.finishCheck(); // locked again for a moment
    expect(gateway.finishUninstallCheck).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    await ctrl.finishCheck();
    expect(screen(ctrl)).toBe('removed');
  });

  it('polls fast during the check (the server may say it failed before "Xong" is pressed, but only "Xong" decides)', async () => {
    let check: MyTraining['member']['uninstallCheck'] = 'none';
    const { ctrl, gateway } = await atRemove({ me: vi.fn(async () => me('stopped', 'connected', check)) });
    await ctrl.startCheck();
    vi.mocked(gateway.me).mockClear();
    check = 'failed';
    await vi.advanceTimersByTimeAsync(FAST_POLL_MS);
    expect(gateway.me).toHaveBeenCalledTimes(1);
    expect(screen(ctrl)).toBe('check');
  });

  it('after a reload in the middle of the check the screen comes back with a fresh 5-second lock', async () => {
    const { ctrl, gateway } = make({ me: stopped('waiting') }, { token: 'tok' });
    ctrl.start();
    await settle();
    expect(screen(ctrl)).toBe('check');
    expect(selectCheckSecondsLeft(ctrl.getState(), Date.now())).toBe(5);
    await ctrl.finishCheck();
    expect(gateway.finishUninstallCheck).not.toHaveBeenCalled();
  });

  it('after a reload with a failed check the failed screen shows, and "again" restarts the check', async () => {
    const { ctrl, gateway } = make({ me: stopped('failed') }, { token: 'tok' });
    ctrl.start();
    await settle();
    expect(screen(ctrl)).toBe('check-failed');
    await ctrl.startCheck();
    expect(gateway.startUninstallCheck).toHaveBeenCalledTimes(1);
    expect(screen(ctrl)).toBe('check');
  });

  it('a check that passed on an earlier visit shows "Đã gỡ" straight away', async () => {
    const { ctrl } = make({ me: vi.fn(async () => me('stopped', 'uninstalled', 'passed')) }, { token: 'tok' });
    ctrl.start();
    await settle();
    expect(screen(ctrl)).toBe('removed');
  });

  it('cannot start while the mentor machine is unreachable: stays on the removal steps, with a message', async () => {
    const { ctrl } = await atRemove({ startUninstallCheck: vi.fn(async () => { throw new ApiError(0, 'x'); }) });
    await ctrl.startCheck();
    expect(screen(ctrl)).toBe('remove');
    expect(ctrl.getState().check.message).toMatch(/Mất kết nối/);
  });

  it('the training ending in the middle (401) is the ended screen', async () => {
    const { ctrl, tokens } = await atRemove({ startUninstallCheck: vi.fn(async () => { throw new ApiError(401, 'x'); }) });
    await ctrl.startCheck();
    expect(screen(ctrl)).toBe('ended');
    expect(tokens.get(ID)).toBeNull();
  });

  it('a lost connection at "Xong" keeps the check and lets the member press it again', async () => {
    let up = false;
    const { ctrl, gateway } = await atRemove({ finishUninstallCheck: vi.fn(async () => { if (!up) throw new ApiError(0, 'x'); return { result: 'passed' as const }; }) });
    await ctrl.startCheck();
    await vi.advanceTimersByTimeAsync(5_000);
    await ctrl.finishCheck();
    expect(screen(ctrl)).toBe('check');
    expect(ctrl.getState().check.message).toMatch(/Mất kết nối/);
    up = true;
    await ctrl.finishCheck();
    expect(gateway.finishUninstallCheck).toHaveBeenCalledTimes(2);
    expect(screen(ctrl)).toBe('removed');
  });
});

describe('TrainingMemberController: subscribers', () => {
  it('are told about every change and can unsubscribe', async () => {
    const { ctrl } = make({}, { token: 'tok' });
    const seen = vi.fn();
    const off = ctrl.subscribe(seen);
    ctrl.start();
    await settle();
    expect(seen).toHaveBeenCalled();
    seen.mockClear();
    off();
    await vi.advanceTimersByTimeAsync(FAST_POLL_MS);
    expect(seen).not.toHaveBeenCalled();
  });
});
