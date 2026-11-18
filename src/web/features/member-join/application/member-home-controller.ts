import type { ActiveSession, MeResponse } from '../../../../shared/api/index.js';
import { ROOM_CODE_LENGTH } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { TokenStore } from '../../../shared/token-store/token-store.js';
import { decideScreen, type MeState, type MemberScreen, type RejoinState } from '../domain/member-screen.js';
import { findMySessionByCode, forgetMySession, recentMySessions, rememberMySession, type MySession } from '../domain/my-sessions.js';
import { InMemoryMySessionsStore, type MemberGateway, type MySessionsStore, type RoomCodeMemory } from './member-gateway.js';

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
  /** That close came from the session clock running out (PRODUCT.md §7.27), not from the mentor. */
  endedByTimer: boolean;
  /** "Phiên của bạn trên máy này" (PRODUCT.md §7.29): sessions this browser joined and still holds a seat in, newest first. */
  mine: MySession[];
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
  /** The token this browser held for a session before it asked to be let back in; restored if the request ends without a seat. */
  private priorToken: { sessionId: number; token: string | null } | null = null;
  private wasTaking = false;

  constructor(private gateway: MemberGateway, private tokens: TokenStore, private rooms: RoomCodeMemory, private pollMs = POLL_MS, private mineStore: MySessionsStore = new InMemoryMySessionsStore()) {
    // Resume the session this tab (or, for a new tab, the last tab) was in, if a token for it is still here.
    const id = Number(tokens.getCurrentSessionId());
    const followId = id > 0 && tokens.getToken(id) ? id : null;
    this.state = { followId, lookup: null, me: null, meState: 'idle', rejoin: null, rejoinOffline: false, autoSubmitted: false, endedByTimer: false, mine: this.visibleMine() };
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
    else if (screen === 'ended' && this.wasTaking) {
      this.wasTaking = false;
      // The server says why it closed (deadline vs the mentor's early "Đóng"); no guessing from this device's clock.
      this.state = { ...this.state, autoSubmitted: true, endedByTimer: this.state.me?.session.closedByTimer ?? false };
    }
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
      // Polled every few seconds: only touch storage and the visible list when something changed.
      const before = this.mineStore.load();
      const after = rememberMySession(before, { sessionId, title: me.session.title, status: me.session.status, roomCode: this.rooms.recall(sessionId) }, Date.now());
      this.set({ me, meState: 'ok', ...(after === before ? {} : this.changeMine(() => after)) });
    } catch (err) {
      if (n !== this.meSeq) return;
      if (err instanceof ApiError && err.status === 401) { // unknown token (e.g. server DB was reset): start over
        this.tokens.clearToken(sessionId);
        this.tokens.clearCurrentSessionId();
        this.set({ followId: null, me: null, meState: 'idle', ...this.changeMine(list => forgetMySession(list, sessionId)) });
      } else if (err instanceof ApiError && err.status === 403) {
        // Kicked or replaced: no seat left, so the session leaves "my sessions" now, not only when "leave" is pressed (§7.29d).
        // The token stays until then, so the kicked/replaced screen still shows after a reload.
        this.set({ meState: err.code === 'replaced' ? 'replaced' : 'kicked', ...this.changeMine(list => forgetMySession(list, sessionId)) });
      }
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
    // A session this browser joined: open it without asking the server (an ended session's code is not valid there,
    // and a lookup would count as a wrong code). Other browsers cannot tell an ended session from a wrong code (§7.16, §7.29).
    const known = findMySessionByCode(this.mineStore.load(), code);
    if (known && this.tokens.getToken(known.sessionId)) { this.openMine(known.sessionId); return; }
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
    const room = selectRoom(this.state);
    const found = room?.id === sessionId ? room : null;
    this.set(this.changeMine(list => rememberMySession(list, { sessionId, roomCode, title: found?.title, status: found?.status }, Date.now())));
  }
  /** After a successful `join`: follow that session and load the member's state. */
  async joined(sessionId: number): Promise<void> {
    this.priorToken = null; // a new token was accepted: the old one is not coming back
    this.follow(sessionId, {});
    await this.fetchMe(sessionId);
  }

  /** Follow a session and reset what we knew about it. `react()` is told, so it does not also fetch: the caller does, once. */
  private follow(sessionId: number, patch: Partial<MemberHomeState>): void {
    this.lastFollowId = sessionId;
    this.set({ followId: sessionId, me: null, meState: 'idle', ...patch });
  }

  recallRoom(sessionId: number): string { return this.rooms.recall(sessionId); }

  /**
   * "That email/name is me, let me back in." Approved at once only when the mentor allowed this person back beforehand;
   * otherwise it waits for the mentor and this browser follows the request (polling + the session's events).
   */
  async requestRejoin(sessionId: number, displayName: string, roomCode: string, email?: string): Promise<void> {
    const res = await this.gateway.requestRejoin(sessionId, { displayName, roomCode, ...(email ? { email } : {}) });
    // This browser may already hold a token for the session: keep it, so cancelling or being turned down does not lose it.
    this.priorToken = { sessionId, token: this.tokens.getToken(sessionId) };
    this.tokens.setToken(sessionId, res.token); // reads only the request's status until approved, then it is the participant token
    this.tokens.setCurrentSessionId(sessionId);
    this.rooms.remember(sessionId, roomCode);
    if (res.status === 'approved') { await this.joined(sessionId); return; }
    this.follow(sessionId, { rejoin: 'pending', rejoinOffline: false });
    await this.fetchRejoin();
  }

  /** Checks where the request stands: approved → become the member; answered no or expired → say so. */
  fetchRejoin = async (): Promise<void> => {
    if (this.state.rejoin !== 'pending' || this.state.followId === null) return;
    try {
      const { status } = await this.gateway.getRejoinStatus();
      if (this.state.rejoin !== 'pending') return;
      if (status === 'approved') { this.priorToken = null; this.set({ rejoin: null, rejoinOffline: false }); await this.fetchMe(this.state.followId!); }
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
    if (id !== null) {
      const prior = this.priorToken?.sessionId === id ? this.priorToken.token : null;
      if (prior) this.tokens.setToken(id, prior); else this.tokens.clearToken(id);
    }
    this.priorToken = null;
    this.tokens.clearCurrentSessionId();
    this.set({ followId: null, rejoin: null, rejoinOffline: false, me: null, meState: 'idle', mine: this.visibleMine() });
  }

  /** Done with the session on screen (its result, or being kicked): back to the room code step. */
  leave(): void {
    const id = this.state.followId;
    if (id !== null) this.tokens.clearToken(id); // kicked or replaced: this browser has no seat left, so it forgets the session (§7.29)
    this.priorToken = null;
    this.tokens.clearCurrentSessionId();
    this.lookupSeq++;
    const mine = id !== null ? this.changeMine(list => forgetMySession(list, id)) : {};
    this.set({ followId: null, lookup: null, me: null, meState: 'idle', rejoin: null, rejoinOffline: false, ...mine });
  }

  /** The kicked screen's "join again": clear the token, then look the room up again with the remembered code. */
  leaveKicked(): void {
    const id = this.state.followId;
    const code = id !== null ? this.rooms.recall(id) : '';
    this.leave();
    if (code) void this.lookUpRoom(code);
  }

  /** The ended screen's "another room": keep the token, so the result can be reopened from "my sessions" or its code (§7.29). */
  leaveEnded(): void {
    this.tokens.clearCurrentSessionId();
    this.lookupSeq++;
    // The next session starts clean: an auto-submit here must not label a later session's result.
    this.set({ followId: null, lookup: null, me: null, meState: 'idle', autoSubmitted: false, endedByTimer: false, mine: this.visibleMine() });
  }

  // ── "Phiên của bạn trên máy này" (PRODUCT.md §7.29) ────────────────────────────────────────────

  /** Open a session from the list (or a remembered code): follow it; `/api/me` decides the screen. */
  openMine(sessionId: number): void {
    if (!this.tokens.getToken(sessionId)) { this.set({ mine: this.visibleMine() }); return; }
    this.lookupSeq++;
    this.tokens.setCurrentSessionId(sessionId);
    if (this.state.followId === sessionId) { this.set({ lookup: null }); void this.fetchMe(sessionId); return; }
    this.set({ lookup: null, followId: sessionId, autoSubmitted: false, endedByTimer: false });
  }

  /** "Xoá khỏi máy này": drop the seat and the entry; this browser cannot reopen that session afterwards. */
  forgetMine(sessionId: number): void {
    if (this.state.followId === sessionId) return; // only offered on the code screen
    this.tokens.clearToken(sessionId);
    this.set(this.changeMine(list => forgetMySession(list, sessionId)));
  }

  /** Refresh the listed sessions' status (public: exam title + status only). Failures keep what was known. */
  async refreshMine(): Promise<void> {
    const shown = this.state.mine;
    const fresh = await Promise.all(shown.map(async s => { try { return await this.gateway.getPublicSession(s.sessionId); } catch { return null; } }));
    let list = this.mineStore.load();
    // Only update entries still stored: one forgotten while the requests were in flight must not come back.
    for (const f of fresh) if (f && list.some(s => s.sessionId === f.id)) list = rememberMySession(list, { sessionId: f.id, title: f.title, status: f.status }, Date.now());
    this.set(this.changeMine(() => list));
  }

  /** Applies a change to the stored list and returns the patch for the visible one. */
  private changeMine(fn: (list: MySession[]) => MySession[]): { mine: MySession[] } {
    const before = this.mineStore.load();
    const after = fn(before);
    if (after !== before) this.mineStore.save(after);
    return { mine: this.visibleMine(after) };
  }

  /** Only sessions this browser still holds a seat in can be opened, so only those are listed. */
  private visibleMine(list: MySession[] = this.mineStore.load()): MySession[] {
    return recentMySessions(list.filter(s => this.tokens.getToken(s.sessionId)));
  }
}
