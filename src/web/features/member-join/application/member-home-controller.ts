import type { ActiveSession, MeResponse } from '../../../../shared/api/index.js';
import { ROOM_CODE_LENGTH } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { TokenStore } from '../../../shared/token-store/token-store.js';
import { decideScreen, type MeState, type MemberScreen, type RejoinState } from '../domain/member-screen.js';
import type { MemberGateway, RoomCodeMemory } from './member-gateway.js';

/** What looking up a room code produced. `error.status` is the HTTP status (0 = no connection). */
export interface RoomLookup {
  code: string;
  status: 'checking' | 'ok' | 'error';
  session: ActiveSession | null;
  error: { status: number; message: string } | null;
}

export interface MemberHomeState {
  /** The session this browser holds a token for and follows (several sessions may run at once, so this is explicit). */
  followId: number | null;
  /** The last room code looked up (typed or from a link). */
  lookup: RoomLookup | null;
  me: MeResponse | null;
  meState: MeState;
  /** This browser asked the mentor to be let back in (PRODUCT.md §7.23); null when it has no such request. */
  rejoin: RejoinState | null;
  /** The last check of the request failed to reach the server: the request is kept, the screen says so. */
  rejoinOffline: boolean;
  /** This browser saw the member working, then the session closed under them (the attempt was submitted for them). */
  autoSubmitted: boolean;
}

export const POLL_MS = 5000;

export const selectRoom = (s: MemberHomeState): ActiveSession | null => (s.lookup?.status === 'ok' ? s.lookup.session : null);
export const selectScreen = (s: MemberHomeState): MemberScreen => decideScreen({ followId: s.followId, room: selectRoom(s), me: s.me, meState: s.meState, rejoin: s.rejoin });
/** The session whose events and `/api/me` this page follows. */
export const selectFollowedId = (s: MemberHomeState): number | null => s.followId;

/**
 * What a member sees at "/": finds a session by its room code, follows the session they joined (polling + SSE
 * nudges), holds the member's own state and handles joining. Plain TypeScript, tested with fakes; `decideScreen`
 * (domain) turns the state into a screen.
 */
export class MemberHomeController {
  private state: MemberHomeState;
  private listeners = new Set<() => void>();
  private meSeq = 0;
  private lookupSeq = 0;
  private lastFollowId: number | null;
  private wasTaking = false;

  constructor(private gateway: MemberGateway, private tokens: TokenStore, private rooms: RoomCodeMemory, private pollMs = POLL_MS) {
    // Resume the session this tab (or, for a new tab, the last tab) was in, if a token for it is still here.
    const id = Number(tokens.getCurrentSessionId());
    const followId = id > 0 && tokens.getToken(id) ? id : null;
    this.state = { followId, lookup: null, me: null, meState: 'idle', rejoin: null, rejoinOffline: false, autoSubmitted: false };
    this.lastFollowId = null; // so the first react() fetches `me` for a resumed session
    this.react();
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
    const id = this.state.followId;
    if (id !== this.lastFollowId) {
      this.lastFollowId = id;
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
    const t = setInterval(() => { if (this.state.followId !== null) void this.fetchMe(this.state.followId); }, this.pollMs);
    return () => clearInterval(t);
  }

  fetchMe = async (sessionId: number): Promise<void> => {
    if (this.state.rejoin === 'pending') { await this.fetchRejoin(); return; } // the token is the request's until the mentor answers
    if (this.state.rejoin !== null) return; // answered no / expired: nothing to load, the screen says so
    const n = ++this.meSeq;
    if (!this.tokens.getToken(sessionId)) { this.set({ followId: null, me: null, meState: 'idle' }); return; }
    this.tokens.setCurrentSessionId(sessionId);
    try {
      const me = await this.gateway.getMe();
      if (n !== this.meSeq) return;
      this.set({ me, meState: 'ok' });
    } catch (err) {
      if (n !== this.meSeq) return;
      if (err instanceof ApiError && err.status === 401) { // unknown token (e.g. server DB was reset): start over
        this.tokens.clearToken(sessionId);
        this.tokens.clearCurrentSessionId();
        this.set({ followId: null, me: null, meState: 'idle' });
      } else if (err instanceof ApiError && err.status === 403) this.set({ meState: err.code === 'replaced' ? 'replaced' : 'kicked' });
      else if (!this.state.me) this.set({ meState: 'error' });
    }
  };

  /** SSE: the session changed, or people joined, were approved or kicked. */
  onSessionEvent = (): void => { if (this.state.followId !== null) void this.fetchMe(this.state.followId); };
  onParticipantsEvent = this.onSessionEvent;

  refreshMe = async (): Promise<void> => { if (this.state.followId !== null) await this.fetchMe(this.state.followId); };

  /**
   * Find the open session for a room code (typed, or from a join link). A code that is already being looked up or
   * found is not asked again: every wrong code counts against the address (the server limits guessing).
   * A session this browser already has a token for is resumed instead of asking for a name again.
   */
  async lookUpRoom(rawCode: string): Promise<void> {
    const code = rawCode.replace(/\D/g, '');
    if (code.length !== ROOM_CODE_LENGTH) { this.clearRoom(); return; }
    const cur = this.state.lookup;
    if (cur && cur.code === code && cur.status !== 'error') return;
    const n = ++this.lookupSeq;
    this.set({ lookup: { code, status: 'checking', session: null, error: null } });
    try {
      const session = await this.gateway.resolveRoom(code);
      if (n !== this.lookupSeq) return;
      this.rooms.remember(session.id, code);
      if (this.tokens.getToken(session.id)) { // already in this session from this browser
        this.tokens.setCurrentSessionId(session.id);
        this.set({ lookup: { code, status: 'ok', session, error: null }, followId: session.id });
      } else this.set({ lookup: { code, status: 'ok', session, error: null }, followId: null });
    } catch (err) {
      if (n !== this.lookupSeq) return;
      const error = err instanceof ApiError ? { status: err.status, message: err.message } : { status: 0, message: '' };
      this.set({ lookup: { code, status: 'error', session: null, error } });
    }
  }

  /** The code was edited: forget what it found. */
  clearRoom(): void {
    this.lookupSeq++;
    if (this.state.lookup) this.set({ lookup: null });
  }

  /** Ask to join the session the code found. Stores the token; rejects with the server error for the form to explain. */
  async join(sessionId: number, displayName: string, roomCode: string, email?: string): Promise<void> {
    const res = await this.gateway.join(sessionId, { displayName, roomCode, ...(email ? { email } : {}) });
    this.tokens.setToken(sessionId, res.token);
    this.tokens.setCurrentSessionId(sessionId);
    this.rooms.remember(sessionId, roomCode);
  }
  /** After a successful `join`: follow that session and load the member's state. */
  async joined(sessionId: number): Promise<void> { this.set({ followId: sessionId }); await this.fetchMe(sessionId); }

  recallRoom(sessionId: number): string { return this.rooms.recall(sessionId); }

  /**
   * "That email/name is me, let me back in." Approved at once only when the mentor allowed this person back beforehand;
   * otherwise it waits for the mentor and this browser follows the request (polling + the session's events).
   */
  async requestRejoin(sessionId: number, displayName: string, roomCode: string, email?: string): Promise<void> {
    const res = await this.gateway.requestRejoin(sessionId, { displayName, roomCode, ...(email ? { email } : {}) });
    this.tokens.setToken(sessionId, res.token); // reads only the request's status until approved, then it is the participant token
    this.tokens.setCurrentSessionId(sessionId);
    this.rooms.remember(sessionId, roomCode);
    if (res.status === 'approved') { await this.joined(sessionId); return; }
    this.set({ followId: sessionId, rejoin: 'pending', rejoinOffline: false });
    await this.fetchRejoin();
  }

  /** Checks where the request stands: approved → become the member; answered no or expired → say so. */
  fetchRejoin = async (): Promise<void> => {
    if (this.state.rejoin !== 'pending' || this.state.followId === null) return;
    try {
      const { status } = await this.gateway.getRejoinStatus();
      if (this.state.rejoin !== 'pending') return;
      if (status === 'approved') { this.set({ rejoin: null, rejoinOffline: false }); await this.fetchMe(this.state.followId!); }
      else if (status === 'rejected') this.set({ rejoin: 'rejected', rejoinOffline: false });
      else if (status === 'expired') this.set({ rejoin: 'expired', rejoinOffline: false });
      else if (status === 'cancelled') this.backFromRejoin();
      else this.set({ rejoinOffline: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) this.backFromRejoin(); // the server forgot the request (e.g. reset)
      else this.set({ rejoinOffline: true });
    }
  };

  /** Withdraw a waiting request and return to the form. */
  async cancelRejoin(): Promise<void> {
    try { await this.gateway.cancelRejoin(); } catch { /* it expires by itself; leaving is what matters */ }
    this.backFromRejoin();
  }

  /** Leave the request screen for the form (the looked-up room stays, so the typed code is not asked again). */
  backFromRejoin(): void {
    const id = this.state.followId;
    if (id !== null) this.tokens.clearToken(id);
    this.tokens.clearCurrentSessionId();
    this.set({ followId: null, rejoin: null, rejoinOffline: false, me: null, meState: 'idle' });
  }

  /** Done with the session on screen (its result, or being kicked): back to the room code step. */
  leave(): void {
    const id = this.state.followId;
    if (id !== null) this.tokens.clearToken(id);
    this.tokens.clearCurrentSessionId();
    this.lookupSeq++;
    this.set({ followId: null, lookup: null, me: null, meState: 'idle', rejoin: null, rejoinOffline: false });
  }

  /** The kicked screen's "join again": clear the token, then look the room up again with the remembered code. */
  leaveKicked(): void {
    const id = this.state.followId;
    const code = id !== null ? this.rooms.recall(id) : '';
    this.leave();
    if (code) void this.lookUpRoom(code);
  }

  /** The ended screen's "another room": keep the token (the result can still be reopened by its code). */
  leaveEnded(): void {
    this.tokens.clearCurrentSessionId();
    this.lookupSeq++;
    this.set({ followId: null, lookup: null, me: null, meState: 'idle' });
  }
}
