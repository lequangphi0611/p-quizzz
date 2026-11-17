import { describe, expect, it } from 'vitest';
import { viewOf } from './rejoin.js';

describe('viewOf', () => {
  it('a waiting request expires once the session is no longer open', () => {
    expect(viewOf({ status: 'pending' }, 'lobby')).toBe('pending');
    expect(viewOf({ status: 'pending' }, 'running')).toBe('pending');
    expect(viewOf({ status: 'pending' }, 'closed')).toBe('expired');
    expect(viewOf({ status: 'pending' }, 'finalized')).toBe('expired');
  });
  it('an answered request stays as answered, whatever the session did since', () => {
    for (const status of ['approved', 'rejected', 'cancelled'] as const) expect(viewOf({ status }, 'closed')).toBe(status);
  });
});
