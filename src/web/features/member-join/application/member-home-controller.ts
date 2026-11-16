import type { ActiveSession, MeResponse } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { TokenStore } from '../../../shared/token-store/token-store.js';
import { decideScreen, type MeState, type MemberScreen } from '../domain/member-screen.js';
import type { MemberGateway, RoomCodeMemory } from './member-gateway.js';

export interface MemberHomeState {
  /** `undefined` until the first /api/sessions/active answer; `null` when nothing is active. */
  active: ActiveSession | null | undefined;
  hasToken: boolean;
  me: MeResponse | null;
  meState: MeState;
  /** The session this browser last joined: followed after it stops being active, so the result stays on screen. */
  remembered: number | null;
  /** The very first load failed: show "Mất kết nối" instead of spinning. */
  activeError: boolean;
  /** This browser saw the member working, then the session closed under them (the attempt was submitted for them). */
  autoSubmitted: boolean;
}

export const POLL_MS = 5000;

export const selectScreen = (s: MemberHomeState): MemberScreen => decideScreen({ active: s.active, hasToken: s.hasToken, me: s.me, meState: s.meState });
export const selectActiveId = (s: MemberHomeState): number | null => (s.active ? s.active.id : s.active === null ? s.remembered : null);

/**
 * What a member sees at "/": follows the active session (polling + SSE nudges), holds the member's own state, and
 * handles joining. Plain TypeScript, tested with fakes; `decideScreen` (domain) turns the state into a screen.
 */
export class MemberHomeController {
  private state: MemberHomeState;
  private listeners = new Set<() => void>();
  private meSeq = 0;
  private lastActiveId: number | null;
  private wasTaking = false;

  constructor(private gateway: MemberGateway, private tokens: TokenStore, private rooms: RoomCodeMemory, private pollMs = POLL_MS) {
    const id = Number(tokens.getCurrentSessionId());
    const remembered = id > 0 && tokens.getToken(id) ? id : null;
    this.state = { active: undefined, hasToken: false, me: null, meState: 'idle', remembered, activeError: false, autoSubmitted: false };
    this.lastActiveId = selectActiveId(this.state);
  }

  getState = (): MemberHomeState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private set(patch: Partial<MemberHomeState>): void {
    this.state = { ...this.state, ...patch };
    this.react();
    for (const l of [...this.listeners]) l();
  }

  /** Side effects of a state change: follow a different session, remember an auto-submit. */
  private react(): void {
    const id = selectActiveId(this.state);
    if (id !== this.lastActiveId) {
      this.lastActiveId = id;
      this.state = { ...this.state, me: null, meState: 'idle' };
      if (id !== null) void this.fetchMe(id);
    }
    const screen = selectScreen(this.state);
    if (screen === 'running' && this.state.me?.attempt.current) this.wasTaking = true;
    else if (screen === 'ended' && this.wasTaking) { this.wasTaking = false; this.state = { ...this.state, autoSubmitted: true }; }
    else if (screen === 'running') this.wasTaking = false;
  }

  /** Start polling (a safety net: SSE makes changes show at once). Returns the stop function. */
  start(): () => void {
    void this.fetchActive();
    const t = setInterval(() => {
      void this.fetchActive();
      const id = selectActiveId(this.state);
      if (id !== null) void this.fetchMe(id);
    }, this.pollMs);
    return () => clearInterval(t);
  }

  fetchActive = async (): Promise<void> => {
    try { this.set({ active: await this.gateway.getActive(), activeError: false }); }
    catch { this.set({ activeError: true }); /* keep what we have; the next poll retries */ }
  };

  fetchMe = async (sessionId: number): Promise<void> => {
    const n = ++this.meSeq;
    if (!this.tokens.getToken(sessionId)) { this.set({ hasToken: false, me: null, meState: 'idle' }); return; }
    this.set({ hasToken: true });
    this.tokens.setCurrentSessionId(sessionId);
    try {
      const me = await this.gateway.getMe();
      if (n !== this.meSeq) return;
      this.set({ me, meState: 'ok' });
    } catch (err) {
      if (n !== this.meSeq) return;
      if (err instanceof ApiError && err.status === 401) { // unknown token (e.g. server DB was reset): start over
        this.tokens.clearToken(sessionId);
        this.set({ remembered: this.state.remembered === sessionId ? null : this.state.remembered, hasToken: false, me: null, meState: 'idle' });
      } else if (err instanceof ApiError && err.status === 403) this.set({ meState: 'kicked' });
      else if (!this.state.me) this.set({ meState: 'error' });
    }
  };

  /** SSE: the session changed. */
  onSessionEvent = (): void => { void this.fetchActive(); const id = selectActiveId(this.state); if (id !== null) void this.fetchMe(id); };
  /** SSE: people joined, were approved or kicked. */
  onParticipantsEvent = (): void => { const id = selectActiveId(this.state); if (id !== null) void this.fetchMe(id); };

  refreshMe = async (): Promise<void> => { const id = selectActiveId(this.state); if (id !== null) await this.fetchMe(id); };

  /** Ask to join. Stores the token and room code; rejects with the server error for the form to explain. */
  async join(sessionId: number, displayName: string, roomCode: string): Promise<void> {
    const res = await this.gateway.join(sessionId, { displayName, roomCode });
    this.tokens.setToken(sessionId, res.token);
    this.tokens.setCurrentSessionId(sessionId);
    this.rooms.remember(sessionId, roomCode);
  }
  /** After a successful `join`: follow that session and load the member's state. */
  async joined(sessionId: number): Promise<void> { this.set({ remembered: sessionId }); await this.fetchMe(sessionId); }

  recallRoom(sessionId: number): string { return this.rooms.recall(sessionId); }

  /** The kicked screen's "back to the join page". */
  leaveKicked(): void {
    const id = selectActiveId(this.state);
    if (id !== null) this.tokens.clearToken(id);
    this.set({ hasToken: false, me: null, meState: 'idle' });
  }
}
