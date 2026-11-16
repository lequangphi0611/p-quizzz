import { describe, expect, it } from 'vitest';
import { connectionOf, ONLINE_WITHIN_MS } from './presence.js';

describe('connectionOf', () => {
  const now = new Date(1_000_000);
  it('online while the last sign of life is within three poll rounds', () => {
    expect(connectionOf(new Date(now.getTime() - 5_000), now)).toEqual({ online: true, lastSeenAt: now.getTime() - 5_000 });
    expect(connectionOf(new Date(now.getTime() - ONLINE_WITHIN_MS), now).online).toBe(true);
  });
  it('offline after that, still remembering when they were last seen', () => {
    const seen = new Date(now.getTime() - ONLINE_WITHIN_MS - 1);
    expect(connectionOf(seen, now)).toEqual({ online: false, lastSeenAt: seen.getTime() });
  });
  it('never seen (server restarted) is offline with no time', () => {
    expect(connectionOf(null, now)).toEqual({ online: false, lastSeenAt: null });
  });
});
