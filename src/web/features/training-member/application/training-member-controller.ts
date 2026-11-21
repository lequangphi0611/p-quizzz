import type { HookConfig, MyTraining } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { classifyTrainingJoinError, type TrainingJoinFailure } from '../domain/join-failure.js';
import { CHECK_RETRY_WAIT_MS, CHECK_WAIT_MS, checkSecondsLeft, pollDelayMs, showWaitingHint } from '../domain/timing.js';
import { decideTrainingScreen, type CheckProgress, type RoomInfo, type TrainingScreen } from '../domain/training-screen.js';
import type { TrainingMemberGateway, TrainingTokenStore } from './training-member-gateway.js';

const ROOM_CODE_LENGTH = 6;

export interface TrainingRoomState extends RoomInfo {
  /** The training's name, known once the code was looked up (for the consent screen). */
  title: string | null;
  error: { status: number; message: string } | null;
}

export interface TrainingMemberState {
  trainingId: number;
  /** The room code from the address (`?room=`); needed only to join. Empty when absent or malformed. */
  roomCode: string;
  /** This browser's token for the training (`pq:training:<id>`); null before joining and after anything that ends the membership. */
  token: string | null;
  room: TrainingRoomState;
  me: MyTraining | null;
  /** The last request never reached the mentor's machine; the screen says so and the page keeps retrying. */
  offline: boolean;
  /** 401: training ended, member withdrew or was removed, or the server forgot the token. The token is already cleared. */
  gone: boolean;
  /** `gone` after this member had stopped sending: the mentor deleted their data ("Đã xoá dữ liệu"). */
  deleted: boolean;
  join: { busy: boolean; error: TrainingJoinFailure | null };
  hookConfig: { status: 'idle' | 'loading' | 'ok' | 'error'; value: HookConfig | null };
  /** When the install screen began waiting for the first signal (for the "maybe check this" hint). */
  installSince: number | null;
  check: CheckProgress & {
    /** When "Xong" unlocks (5 seconds after the check began); null when no check is counting. */
    readyAt: number | null;
    /** Why the last step of the check did not go through, for the member. */
    message: string | null;
  };
  withdraw: { busy: boolean; error: string | null };
}

export interface TrainingMemberDeps {
  gateway: TrainingMemberGateway;
  tokens: TrainingTokenStore;
  now?: () => number;
  /** A hidden tab does not poll (it refreshes when it is shown again). */
  isHidden?: () => boolean;
}

export const selectScreen = (s: TrainingMemberState): TrainingScreen =>
  decideTrainingScreen({ hasToken: s.token !== null, gone: s.gone, deleted: s.deleted, me: s.me, offline: s.offline, room: { status: s.room.status, errorStatus: s.room.error?.status }, check: s.check });
export const selectWaitingHint = (s: TrainingMemberState, now: number): boolean => selectScreen(s) === 'install' && showWaitingHint(s.installSince, now);
export const selectCheckSecondsLeft = (s: TrainingMemberState, now: number): number => checkSecondsLeft(s.check.readyAt, now);

const isRoomCode = (code: string): boolean => code.length === ROOM_CODE_LENGTH && /^\d+$/.test(code);
const errorStatus = (err: unknown): number => (err instanceof ApiError ? err.status : 0);
const errorMessage = (err: unknown): string => (err instanceof ApiError ? err.message : '');

/**
 * What a member sees at `/training/:id`: looks the room code up (for the title), joins after consent, then follows
 * `GET /api/training/me` (fast while waiting for the first signal or for the removal check, slow otherwise, paused in a
 * hidden tab), loads the hook config while the install screen is up and runs the removal check. Plain TypeScript,
 * tested with fakes; `decideTrainingScreen` (domain) turns the state into a screen. The page creates it once and calls `start()`.
 */
export class TrainingMemberController {
  private state: TrainingMemberState;
  private listeners = new Set<() => void>();
  private readonly now: () => number;
  private readonly isHidden: () => boolean;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private timerDelay: number | null = null;
  private meSeq = 0;
  private lookingUp = false;

  constructor(private deps: TrainingMemberDeps, trainingId: number, roomCode: string) {
    this.now = deps.now ?? Date.now;
    this.isHidden = deps.isHidden ?? (() => typeof document !== 'undefined' && document.hidden);
    const token = deps.tokens.get(trainingId);
    const code = isRoomCode(roomCode) ? roomCode : '';
    this.state = {
      trainingId,
      roomCode: code,
      token: token || null,
      room: { status: !token && code ? 'checking' : 'none', title: null, error: null },
      me: null,
      offline: false,
      gone: false,
      deleted: false,
      join: { busy: false, error: null },
      hookConfig: { status: 'idle', value: null },
      installSince: null,
      check: { phase: 'idle', result: null, readyAt: null, message: null },
      withdraw: { busy: false, error: null },
    };
  }

  getState = (): TrainingMemberState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private set(patch: Partial<TrainingMemberState>): void {
    this.state = { ...this.state, ...patch };
    this.react();
    for (const l of [...this.listeners]) l();
  }

  /** Side effects of a state change. They change `this.state` directly (no re-entrant `set`) and start async work with `void`. */
  private react(): void {
    const screen = selectScreen(this.state);
    const s = this.state;
    if (screen === 'install' && s.installSince === null) this.state = { ...this.state, installSince: this.now() };
    else if (screen !== 'install' && s.installSince !== null) this.state = { ...this.state, installSince: null };
    // The page was reloaded in the middle of the removal check: the server knows it began, this browser does not know when.
    if (screen === 'check' && s.check.phase === 'idle' && s.check.readyAt === null) this.state = { ...this.state, check: { ...this.state.check, readyAt: this.now() + CHECK_WAIT_MS } };
    if (screen === 'install' && s.hookConfig.status === 'idle') { this.state = { ...this.state, hookConfig: { ...s.hookConfig, status: 'loading' } }; void this.loadHookConfig(); }
    this.schedule();
  }

  /** Starts following the server; returns the stop function. Safe to call twice (React StrictMode runs effects twice). */
  start(): () => void {
    this.running = true;
    void this.refresh();
    this.schedule();
    return () => { this.running = false; if (this.timer !== undefined) clearTimeout(this.timer); this.timer = undefined; this.timerDelay = null; };
  }

  /** Looks at the server now: the room code before joining, `me` after. Also called when the tab becomes visible again. */
  refresh = async (): Promise<void> => {
    if (this.state.token) await this.fetchMe();
    else if (this.state.roomCode && !this.state.gone) await this.lookUpRoom();
  };

  private schedule(): void {
    if (!this.running) return;
    const want = pollDelayMs(selectScreen(this.state), this.state.offline);
    if (want === this.timerDelay && (this.timer !== undefined || want === null)) return;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.timerDelay = want;
    if (want === null) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.timerDelay = null;
      void (async () => {
        if (!this.isHidden()) await this.refresh();
        this.schedule();
      })();
    }, want);
  }

  // ── Before joining ─────────────────────────────────────────────────────────────────────────────

  private async lookUpRoom(): Promise<void> {
    const { room, roomCode, trainingId } = this.state;
    if (this.lookingUp || room.status === 'ok') return;
    if (room.status === 'error' && room.error?.status !== 0) return; // a wrong code is not asked again (every wrong code counts at the server)
    this.lookingUp = true;
    // After a failed attempt the old screen stays while retrying (no flicker between "offline" and "loading" every few seconds).
    if (room.status !== 'error') this.set({ room: { status: 'checking', title: null, error: null } });
    try {
      const found = await this.deps.gateway.resolveRoom(roomCode);
      if (found.kind === 'training' && found.id === trainingId) this.set({ room: { status: 'ok', title: found.title, error: null }, offline: false });
      else this.set({ room: { status: 'error', title: null, error: { status: 403, message: '' } }, offline: false }); // the code opens something else
    } catch (err) {
      this.set({ room: { status: 'error', title: null, error: { status: errorStatus(err), message: errorMessage(err) } } });
    } finally {
      this.lookingUp = false;
    }
  }

  /** Retry after a lookup that could not reach the server (the "Thử lại" button). */
  retryRoom = async (): Promise<void> => {
    await this.lookUpRoom();
  };

  /**
   * "Đồng ý và tiếp tục": joins and keeps the token. Does nothing unless `consented` is true: without consent no request is sent.
   * Resolves true when the member is in. Failures are in `state.join.error` for the form to explain.
   */
  join = async (displayName: string, consented: boolean): Promise<boolean> => {
    const name = displayName.trim();
    const { room, roomCode, trainingId, join } = this.state;
    if (!consented || !name || join.busy || room.status !== 'ok') return false;
    this.set({ join: { busy: true, error: null } });
    try {
      const res = await this.deps.gateway.join(trainingId, { displayName: name, roomCode });
      this.deps.tokens.set(trainingId, res.token);
      this.set({ token: res.token, me: null, offline: false, join: { busy: false, error: null } });
      await this.fetchMe();
      return true;
    } catch (err) {
      const failure = classifyTrainingJoinError(err instanceof ApiError ? err.status : null, errorMessage(err), err instanceof ApiError ? err.code : undefined);
      // The code is wrong or the training stopped under the member: the consent form has nothing left to offer.
      if (failure.kind === 'room') this.set({ join: { busy: false, error: null }, room: { status: 'error', title: null, error: { status: 403, message: failure.message } } });
      else this.set({ join: { busy: false, error: failure } });
      return false;
    }
  };

  // ── Following the server ───────────────────────────────────────────────────────────────────────

  private fetchMe = async (): Promise<void> => {
    const token = this.state.token;
    if (!token) return;
    const n = ++this.meSeq;
    try {
      const me = await this.deps.gateway.me(token);
      if (n !== this.meSeq || this.state.token !== token) return;
      // A failed config load (offline) is tried again once the server answers.
      const hookConfig = this.state.hookConfig.status === 'error' ? { ...this.state.hookConfig, status: 'idle' as const } : this.state.hookConfig;
      this.set({ me, offline: false, hookConfig });
    } catch (err) {
      if (n !== this.meSeq || this.state.token !== token) return;
      if (errorStatus(err) === 401) this.dropToken();
      else this.set({ offline: true });
    }
  };

  /** The server does not know this member any more: forget the token, show "đã kết thúc". */
  private dropToken(): void {
    this.deps.tokens.clear(this.state.trainingId);
    const deleted = this.state.me?.member.connection === 'stopped_sending' && this.state.me.training.status !== 'ended';
    this.set({ token: null, me: null, gone: true, deleted, offline: false });
  }

  private loadHookConfig = async (): Promise<void> => {
    const token = this.state.token;
    if (!token) return;
    try {
      const value = await this.deps.gateway.hookConfig(token);
      if (this.state.token !== token) return;
      this.set({ hookConfig: { status: 'ok', value } });
    } catch (err) {
      if (this.state.token !== token) return;
      const status = errorStatus(err);
      if (status === 401) { this.dropToken(); return; }
      this.set({ hookConfig: { status: 'error', value: null } });
      if (status === 409) await this.fetchMe(); // no longer open: the screen moves on to removal
    }
  };

  /** "Thử lại" next to a config that did not load. */
  retryHookConfig = (): void => {
    if (this.state.hookConfig.status === 'error') this.set({ hookConfig: { status: 'idle', value: null } });
  };

  // ── Removal check ──────────────────────────────────────────────────────────────────────────────

  /** "Kiểm tra đã gỡ": the server notes the moment; anything that still arrives after it means the hook is still there. */
  startCheck = async (): Promise<void> => {
    const token = this.state.token;
    const { phase } = this.state.check;
    if (!token || phase === 'starting' || phase === 'finishing') return;
    this.set({ check: { phase: 'starting', result: null, readyAt: null, message: null } });
    try {
      await this.deps.gateway.startUninstallCheck(token);
      if (this.state.token !== token) return;
      this.set({ check: { phase: 'running', result: null, readyAt: this.now() + CHECK_WAIT_MS, message: null } });
    } catch (err) {
      if (this.state.token !== token) return;
      const status = errorStatus(err);
      if (status === 401) { this.dropToken(); return; }
      this.set({ check: { phase: 'idle', result: null, readyAt: null, message: status === 409 ? 'Mentor chưa dừng thu hoặc buổi đã đổi trạng thái. Tải lại trang rồi thử lại.' : 'Mất kết nối tới máy mentor. Thử lại sau ít giây.' } });
      if (status === 409) await this.fetchMe();
    }
  };

  /** "Xong": asks for the verdict. Does nothing during the first 5 seconds (the button is locked and shows the count). */
  finishCheck = async (): Promise<void> => {
    const token = this.state.token;
    const { phase, readyAt } = this.state.check;
    if (!token || phase === 'starting' || phase === 'finishing' || checkSecondsLeft(readyAt, this.now()) > 0) return;
    this.set({ check: { ...this.state.check, phase: 'finishing', message: null } });
    try {
      const { result } = await this.deps.gateway.finishUninstallCheck(token);
      if (this.state.token !== token) return;
      this.set({ check: { phase: 'idle', result, readyAt: null, message: null } });
      if (result === 'passed') await this.fetchMe(); // the server now says "uninstalled"
    } catch (err) {
      if (this.state.token !== token) return;
      const status = errorStatus(err);
      if (status === 401) { this.dropToken(); return; }
      if (err instanceof ApiError && err.code === 'too_early') { // asked a moment before the server's quiet period is over: wait a little more
        this.set({ check: { phase: 'running', result: null, readyAt: this.now() + CHECK_RETRY_WAIT_MS, message: 'Chờ thêm vài giây rồi bấm Xong lại.' } });
        return;
      }
      if (status === 409) { // not stopped, or the check was never started: the server's state decides the screen
        this.set({ check: { phase: 'idle', result: null, readyAt: null, message: null } });
        await this.fetchMe();
        return;
      }
      this.set({ check: { phase: 'running', result: null, readyAt: this.state.check.readyAt, message: 'Mất kết nối tới máy mentor. Bấm Xong lại sau ít giây.' } });
    }
  };

  // ── Leaving ────────────────────────────────────────────────────────────────────────────────────

  /**
   * "Dừng gửi": the server stops taking data from this member at once, but what was already sent stays until the mentor approves
   * deleting it or ends the training. The member stays on the page (now the "sending-stopped" screen) and keeps their token.
   * Resolves true when done; false when the mentor's machine could not be reached or the training had just stopped
   * (`state.withdraw.error` says so, and the member can try again).
   */
  withdraw = async (): Promise<boolean> => {
    const token = this.state.token;
    if (!token || this.state.withdraw.busy) return false;
    this.set({ withdraw: { busy: true, error: null } });
    try {
      await this.deps.gateway.withdraw(token);
    } catch (err) {
      const status = errorStatus(err);
      if (status === 401) { this.set({ withdraw: { busy: false, error: null } }); this.dropToken(); return true; } // already gone
      if (status === 409) { // the mentor stopped the training meanwhile: nothing left to stop, the screen moves on to removal
        this.set({ withdraw: { busy: false, error: null } });
        await this.fetchMe();
        return true;
      }
      this.set({ withdraw: { busy: false, error: 'Mất kết nối tới máy mentor nên chưa dừng gửi được. Thử lại sau ít giây.' } });
      return false;
    }
    this.set({ withdraw: { busy: false, error: null } });
    await this.fetchMe(); // the server now says `stopped_sending`
    return true;
  };

  /** Clears an error shown in the withdraw dialog (when it is closed). */
  clearWithdrawError = (): void => { if (this.state.withdraw.error) this.set({ withdraw: { busy: false, error: null } }); };
}
