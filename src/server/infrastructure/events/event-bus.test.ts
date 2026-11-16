import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from './event-bus.js';

describe('event bus', () => {
  it('delivers to subscribers of that session only', () => {
    const bus = createEventBus();
    const a = vi.fn(), b = vi.fn(), other = vi.fn();
    bus.subscribe(1, a);
    bus.subscribe(1, b);
    bus.subscribe(2, other);
    bus.publish(1, 'participants');
    expect(a).toHaveBeenCalledWith('participants');
    expect(b).toHaveBeenCalledWith('participants');
    expect(other).not.toHaveBeenCalled();
  });

  it('unsubscribe stops delivery and frees the session entry', () => {
    const bus = createEventBus();
    const l = vi.fn();
    const off = bus.subscribe(1, l);
    expect(bus.listenerCount(1)).toBe(1);
    off();
    bus.publish(1, 'session');
    expect(l).not.toHaveBeenCalled();
    expect(bus.listenerCount(1)).toBe(0);
  });

  it('a listener unsubscribing during publish does not break others', () => {
    const bus = createEventBus();
    const second = vi.fn();
    const off = bus.subscribe(1, () => off());
    bus.subscribe(1, second);
    expect(() => bus.publish(1, 'leaderboard')).not.toThrow();
    expect(second).toHaveBeenCalledOnce();
  });

  it('subscribeAll hears every session with its id, and stops after unsubscribe', () => {
    const bus = createEventBus();
    const all = vi.fn(), one = vi.fn();
    const off = bus.subscribeAll(all);
    bus.subscribe(1, one);
    bus.publish(1, 'participants');
    bus.publish(2, 'session');
    expect(all.mock.calls).toEqual([[1, 'participants'], [2, 'session']]);
    expect(one).toHaveBeenCalledTimes(1);
    expect(bus.allListenerCount()).toBe(1);
    off();
    bus.publish(1, 'session');
    expect(all).toHaveBeenCalledTimes(2);
    expect(bus.allListenerCount()).toBe(0);
  });
});
