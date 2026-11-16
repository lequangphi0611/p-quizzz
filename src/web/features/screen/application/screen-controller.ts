import type { ActiveSession, LeaderboardResponse } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { ScreenGateway } from './screen-gateway.js';

export interface ScreenState {
  /** `undefined` until the first answer; `null` when no session exists yet. */
  latest: ActiveSession | null | undefined;
  names: string[];
  board: LeaderboardResponse | null;
  roomCode: string | null;
  /** This machine is not the mentor's: the server will not hand out the code. */
  roomHidden: boolean;
}

export const SCREEN_POLL_MS = 5000;

/**
 * The projector page follows the latest session: the active one, else the one that just ended, and switches by
 * itself when the mentor opens the next. Plain TypeScript, tested with a fake gateway.
 */
export class ScreenController {
  private state: ScreenState = { latest: undefined, names: [], board: null, roomCode: null, roomHidden: false };
  private listeners = new Set<() => void>();
  private seq = 0;
  private lastId: number | null = null;

  constructor(private gateway: ScreenGateway, private pollMs = SCREEN_POLL_MS) {}

  getState = (): ScreenState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private get id(): number | null { return this.state.latest?.id ?? null; }

  private set(patch: Partial<ScreenState>): void {
    this.state = { ...this.state, ...patch };
    if (this.id !== this.lastId) { // a different session: drop the old data and load the new
      this.lastId = this.id;
      this.state = { ...this.state, names: [], board: null, roomCode: null };
      void this.fetchData();
    }
    for (const l of [...this.listeners]) l();
  }

  start(): () => void {
    void this.fetchLatest();
    const t = setInterval(() => { void this.fetchLatest(); void this.fetchData(); }, this.pollMs);
    return () => clearInterval(t);
  }

  fetchLatest = async (): Promise<void> => {
    try { this.set({ latest: await this.gateway.getLatest() }); } catch { /* keep showing what we have */ }
  };

  fetchData = async (): Promise<void> => {
    const id = this.id;
    if (id === null) return;
    const n = ++this.seq;
    try {
      const [p, b] = await Promise.all([this.gateway.getParticipants(id), this.gateway.getLeaderboard(id)]);
      if (n !== this.seq || this.id !== id) return;
      this.set({ names: p.map(x => x.displayName), board: b });
    } catch { /* the next event or poll refreshes */ }
    try {
      const r = await this.gateway.getRoom();
      if (this.id === id) this.set({ roomCode: r.roomCode, roomHidden: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) this.set({ roomCode: null, roomHidden: true });
    }
  };

  /** SSE: anything about the session changed. */
  onSessionEvent = (): void => { void this.fetchLatest(); void this.fetchData(); };
  onDataEvent = (): void => { void this.fetchData(); };
}
