import { describe, expect, it } from 'vitest';
import type { ActiveSession, MeResponse } from '../../shared/api/index.js';
import type { SessionStatus } from '../../shared/session-state.js';
import { decideScreen, type MeState } from './member-screen.js';

const active = (status: 'lobby' | 'running' = 'lobby'): ActiveSession => ({ id: 1, title: 'Đề', status });
const me = (p: 'active' | 'pending' | 'kicked', s: SessionStatus, sessionId = 1): MeResponse => ({
  participant: { id: 1, displayName: 'An', status: p, joinedAt: 0 },
  session: { id: sessionId, title: 'Đề', status: s, participantCount: 3 },
  attempt: null,
});
const screen = (a: ActiveSession | null | undefined, hasToken: boolean, m: MeResponse | null, meState: MeState = m ? 'ok' : 'idle') =>
  decideScreen({ active: a, hasToken, me: m, meState });

describe('decideScreen', () => {
  it('loading until the first active-session answer', () => expect(screen(undefined, false, null)).toBe('loading'));
  it('no active session → none (even with a stale token)', () => {
    expect(screen(null, false, null)).toBe('none');
    expect(screen(null, true, me('active', 'lobby'))).toBe('none');
  });
  it('active session without a token → join form', () => {
    expect(screen(active(), false, null)).toBe('join');
    expect(screen(active('running'), false, null)).toBe('join');
  });
  it('token but /api/me not answered yet → loading; failed → error', () => {
    expect(screen(active(), true, null, 'idle')).toBe('loading');
    expect(screen(active(), true, null, 'error')).toBe('error');
  });
  it('active member: lobby → lobby, running → running', () => {
    expect(screen(active('lobby'), true, me('active', 'lobby'))).toBe('lobby');
    expect(screen(active('running'), true, me('active', 'running'))).toBe('running');
  });
  it('pending member waits for approval', () => expect(screen(active('running'), true, me('pending', 'running'))).toBe('pending'));
  it('kicked: from /api/me 403 or from the participant status', () => {
    expect(screen(active(), true, null, 'kicked')).toBe('kicked');
    expect(screen(active(), true, me('kicked', 'lobby'))).toBe('kicked');
  });
  it('a session that moved past running → ended', () => {
    expect(screen(active('running'), true, me('active', 'closed'))).toBe('ended');
    expect(screen(active('running'), true, me('active', 'finalized'))).toBe('ended');
  });
  it('me from another session does not leak into the current one', () => {
    expect(screen(active(), true, me('active', 'lobby', 99), 'ok')).toBe('loading');
  });
});
