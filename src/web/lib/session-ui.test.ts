import { describe, expect, it } from 'vitest';
import { nextStatus, type SessionStatus } from '../../shared/session-state.js';
import { ACTION_FOR_STATUS } from './session-ui.js';

describe('ACTION_FOR_STATUS', () => {
  it('every offered action is valid for its status, and finalized offers none', () => {
    for (const [status, spec] of Object.entries(ACTION_FOR_STATUS) as [SessionStatus, (typeof ACTION_FOR_STATUS)[SessionStatus]][]) {
      if (spec) expect(nextStatus(status, spec.action), status).not.toBeNull();
      else expect(status).toBe('finalized');
    }
  });

  it('only start and close ask for confirmation', () => {
    const confirming = Object.values(ACTION_FOR_STATUS).filter(s => s?.confirm).map(s => s!.action);
    expect(confirming).toEqual(['start', 'close']);
  });

  it('the start confirmation mentions how many people are waiting', () => {
    expect(ACTION_FOR_STATUS.lobby!.confirm!.body(7)).toContain('7 người');
  });
});
