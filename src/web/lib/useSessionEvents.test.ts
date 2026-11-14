import { describe, expect, it, vi } from 'vitest';
import { connectSessionEvents, type EventSourceLike } from './useSessionEvents.js';

function fakeSource() {
  const l = new Map<string, () => void>();
  let closed = false;
  const es: EventSourceLike = { addEventListener: (t, f) => void l.set(t, f), close: () => { closed = true; } };
  return { es, fire: (t: string) => l.get(t)?.(), isClosed: () => closed };
}

describe('connectSessionEvents', () => {
  it('connects to the session stream and dispatches by event type', () => {
    const src = fakeSource();
    let url = '';
    const handlers = { participants: vi.fn(), session: vi.fn() };
    connectSessionEvents(5, () => handlers, u => { url = u; return src.es; });
    src.fire('participants');
    expect(url).toBe('/api/sessions/5/events');
    expect(handlers.participants).toHaveBeenCalledOnce();
    expect(handlers.session).not.toHaveBeenCalled();
  });

  it('calls every handler once after a reconnect, not on the first open', () => {
    const src = fakeSource();
    const handlers = { session: vi.fn(), participants: vi.fn(), leaderboard: vi.fn() };
    connectSessionEvents(1, () => handlers, () => src.es);
    src.fire('open');
    expect(handlers.session).not.toHaveBeenCalled();
    src.fire('error');
    src.fire('open');
    expect(handlers.session).toHaveBeenCalledOnce();
    expect(handlers.participants).toHaveBeenCalledOnce();
    expect(handlers.leaderboard).toHaveBeenCalledOnce();
    src.fire('open'); // a later plain open does not refetch again
    expect(handlers.session).toHaveBeenCalledOnce();
  });

  it('closes the source on cleanup', () => {
    const src = fakeSource();
    connectSessionEvents(1, () => ({}), () => src.es)();
    expect(src.isClosed()).toBe(true);
  });
});
