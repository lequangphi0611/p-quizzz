import type { ActiveSession, LeaderboardResponse } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { ScreenGateway } from './screen-gateway.js';

export interface ScreenState {
  /** `undefined` until the first answer; `null` when the session does not exist. */
  session: ActiveSession | null | undefined;
  names: string[];
  board: LeaderboardResponse | null;
  roomCode: string | null;
  /** This machine is not the mentor's: the server will not hand out the code. */
  roomHidden: boolean;
}

export const SCREEN_POLL_MS = 5000;

/**
 * The projector page follows ONE session (the address names it: several may be open at once). Plain TypeScript,
 * tested with a fake gateway.
 */
export class ScreenController {
  private state: ScreenState = { session: undefined, names: [], board: null, roomCode: null, roomHidden: false };
  private listeners = new Set<() => void>();
  private seq = 0;

  constructor(private gateway: ScreenGateway, readonly sessionId: number, private pollMs = SCREEN_POLL_MS) {}

  getState = (): ScreenState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private set(patch: Partial<ScreenState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) l();
  }

  start(): () => void {
    void this.fetchSession();
    void this.fetchData();
    const t = setInterval(() => { void this.fetchSession(); void this.fetchData(); }, this.pollMs);
    return () => clearInterval(t);
  }

  fetchSession = async (): Promise<void> => {
    try { this.set({ session: await this.gateway.getSession(this.sessionId) }); }
    catch (err) { if (err instanceof ApiError && err.status === 404) this.set({ session: null }); /* else keep showing what we have */ }
  };

  fetchData = async (): Promise<void> => {
    const id = this.sessionId;
    const n = ++this.seq;
    try {
      const [p, b] = await Promise.all([this.gateway.getParticipants(id), this.gateway.getLeaderboard(id)]);
      if (n !== this.seq) return;
      this.set({ names: p.map(x => x.displayName), board: b });
    } catch { /* the next event or poll refreshes */ }
    try {
      const r = await this.gateway.getRoom(id);
      this.set({ roomCode: r.roomCode, roomHidden: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) this.set({ roomCode: null, roomHidden: true });
    }
  };

  /** SSE: anything about the session changed. */
  onSessionEvent = (): void => { void this.fetchSession(); void this.fetchData(); };
  onDataEvent = (): void => { void this.fetchData(); };
}
