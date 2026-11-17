import { describe, expect, it } from 'vitest';
import type { ActiveSession, MeResponse } from '../../../../shared/api/index.js';
import type { SessionStatus } from '../../../../shared/session-state.js';
import { decideScreen, type MeState } from './member-screen.js';

const room = (status: 'lobby' | 'running' = 'lobby'): ActiveSession => ({ id: 1, title: 'Đề', status, access: 'free' });
const me = (p: 'active' | 'pending' | 'kicked', s: SessionStatus, sessionId = 1): MeResponse => ({
  participant: { id: 1, displayName: 'An', status: p, joinedAt: 0 },
  session: { id: sessionId, title: 'Đề', status: s, participantCount: 3, questionCount: 5, totalPoints: 10, hasEssay: true, scoresHidden: false },
  attempt: { current: null, submitted: [], canStartNew: false },
});
const screen = (followId: number | null, r: ActiveSession | null, m: MeResponse | null, meState: MeState = m ? 'ok' : 'idle') =>
  decideScreen({ followId, room: r, me: m, meState });

describe('decideScreen', () => {
  it('not in any session: the code step, or the name step once a code found a session', () => {
    expect(screen(null, null, null)).toBe('code');
    expect(screen(null, room(), null)).toBe('join');
    expect(screen(null, room('running'), null)).toBe('join');
  });
  it('following a session whose /api/me has not answered yet → loading; failed → error', () => {
    expect(screen(1, null, null, 'idle')).toBe('loading');
    expect(screen(1, null, null, 'error')).toBe('error');
  });
  it('active member: lobby → lobby, running → running', () => {
    expect(screen(1, null, me('active', 'lobby'))).toBe('lobby');
    expect(screen(1, null, me('active', 'running'))).toBe('running');
  });
  it('pending member waits for approval', () => expect(screen(1, null, me('pending', 'running'))).toBe('pending'));
  it('kicked: from /api/me 403 or from the participant status', () => {
    expect(screen(1, null, null, 'kicked')).toBe('kicked');
    expect(screen(1, null, me('kicked', 'lobby'))).toBe('kicked');
  });
  it('a session that is over → the result, even though no room is open any more', () => {
    expect(screen(1, null, me('active', 'closed'))).toBe('ended');
    expect(screen(1, null, me('active', 'finalized'))).toBe('ended');
  });
  it('me from another session does not leak into the one being followed', () => {
    expect(screen(1, null, me('active', 'lobby', 99), 'ok')).toBe('loading');
  });
  it('following a session wins over a room that was just looked up', () => {
    expect(screen(1, room(), me('active', 'lobby'))).toBe('lobby');
  });
  it('asking to be let back in shows the request, not the session; replaced says so', () => {
    expect(decideScreen({ followId: 1, room: null, me: null, meState: 'idle', rejoin: 'pending' })).toBe('rejoin');
    expect(decideScreen({ followId: 1, room: null, me: null, meState: 'idle', rejoin: 'rejected' })).toBe('rejoin');
    expect(decideScreen({ followId: 1, room: null, me: me('active', 'running'), meState: 'ok', rejoin: null })).toBe('running');
    expect(screen(1, null, null, 'replaced')).toBe('replaced');
  });
});
