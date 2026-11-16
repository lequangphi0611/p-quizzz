import { describe, expect, it, vi } from 'vitest';
import { connectSessionEvents, createSessionEventHub, type EventSourceLike } from './sse-event-stream.js';

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

describe('createSessionEventHub', () => {
  function factory() {
    const opened: { url: string; src: ReturnType<typeof fakeSource> }[] = [];
    return { opened, create: (url: string) => { const src = fakeSource(); opened.push({ url, src }); return src.es; } };
  }

  it('shares one connection per session between subscribers and fans events out to each', () => {
    const f = factory();
    const hub = createSessionEventHub(f.create);
    const a = { participants: vi.fn() };
    const b = { participants: vi.fn(), session: vi.fn() };
    hub.subscribe(3, () => a);
    hub.subscribe(3, () => b);
    expect(f.opened).toHaveLength(1);
    f.opened[0]!.src.fire('participants');
    expect(a.participants).toHaveBeenCalledOnce();
    expect(b.participants).toHaveBeenCalledOnce();
    expect(b.session).not.toHaveBeenCalled();
  });

  it('opens a separate connection per session', () => {
    const f = factory();
    const hub = createSessionEventHub(f.create);
    hub.subscribe(1, () => ({}));
    hub.subscribe(2, () => ({}));
    expect(f.opened.map(o => o.url)).toEqual(['/api/sessions/1/events', '/api/sessions/2/events']);
  });

  it('closes only when the last subscriber leaves, and reopens for a later subscriber', () => {
    const f = factory();
    const hub = createSessionEventHub(f.create);
    const offA = hub.subscribe(3, () => ({}));
    const offB = hub.subscribe(3, () => ({}));
    offA();
    offA(); // leaving twice is harmless
    expect(f.opened[0]!.src.isClosed()).toBe(false);
    offB();
    expect(f.opened[0]!.src.isClosed()).toBe(true);
    expect(hub.openCount()).toBe(0);
    hub.subscribe(3, () => ({}));
    expect(f.opened).toHaveLength(2);
  });

  it('a subscriber that leaves stops receiving events; the reconnect refetch reaches all remaining ones', () => {
    const f = factory();
    const hub = createSessionEventHub(f.create);
    const a = { session: vi.fn() };
    const b = { session: vi.fn() };
    const offA = hub.subscribe(3, () => a);
    hub.subscribe(3, () => b);
    offA();
    const { src } = f.opened[0]!;
    src.fire('error');
    src.fire('open');
    expect(a.session).not.toHaveBeenCalled();
    expect(b.session).toHaveBeenCalledOnce();
  });
});
