import { describe, expect, it } from 'vitest';
import { nextStatus, SESSION_ACTIONS, type SessionAction, type SessionStatus } from './session-state.js';

const STATUSES: SessionStatus[] = ['draft', 'lobby', 'running', 'closed', 'finalized'];
const VALID: [SessionStatus, SessionAction, SessionStatus][] = [
  ['draft', 'open', 'lobby'],
  ['lobby', 'start', 'running'],
  ['running', 'close', 'closed'],
  ['closed', 'finalize', 'finalized'],
];

describe('nextStatus', () => {
  it.each(VALID)('%s + %s → %s', (from, action, to) => {
    expect(nextStatus(from, action)).toBe(to);
  });

  it('every other (status, action) pair is invalid', () => {
    for (const from of STATUSES) {
      for (const action of SESSION_ACTIONS) {
        if (VALID.some(([f, a]) => f === from && a === action)) continue;
        expect(nextStatus(from, action), `${from} + ${action}`).toBeNull();
      }
    }
  });

  it('finalized is terminal', () => {
    for (const action of SESSION_ACTIONS) expect(nextStatus('finalized', action)).toBeNull();
  });
});
