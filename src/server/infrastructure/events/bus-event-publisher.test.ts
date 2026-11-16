import { describe, expect, it, vi } from 'vitest';
import { BusEventPublisher } from './bus-event-publisher.js';
import { createEventBus } from './event-bus.js';

describe('BusEventPublisher', () => {
  it('delivers to the bus subscribers of that session', async () => {
    const bus = createEventBus();
    const mine = vi.fn(), other = vi.fn();
    bus.subscribe(1, mine);
    bus.subscribe(2, other);
    await new BusEventPublisher(bus).publish(1, 'leaderboard');
    expect(mine).toHaveBeenCalledWith('leaderboard');
    expect(other).not.toHaveBeenCalled();
  });
});
