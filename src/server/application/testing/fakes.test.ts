import { describe, expect, it } from 'vitest';
import { shuffled } from '../../domain/shuffle.js';
import { FakeClock, FakeRandom, FakeTokenGenerator, RecordingEventPublisher } from './fakes.js';

describe('test fakes', () => {
  it('FakeClock stands still until advanced', () => {
    const clock = new FakeClock(1000);
    expect(clock.now()).toEqual(new Date(1000));
    clock.advance(500);
    expect(clock.now().getTime()).toBe(1500);
    clock.set(new Date(7));
    expect(clock.now().getTime()).toBe(7);
  });

  it('FakeTokenGenerator is predictable and unique', () => {
    const gen = new FakeTokenGenerator();
    expect([gen.generate(), gen.generate()]).toEqual(['token-1', 'token-2']);
  });

  it('FakeRandom plays back values in range and makes shuffled() deterministic', () => {
    const r = new FakeRandom([9, 0]);
    expect([r.int(5), r.int(5), r.int(5)]).toEqual([4, 0, 4]);
    const a = shuffled([1, 2, 3, 4], n => new FakeRandom([0]).int(n));
    expect(a).toEqual([2, 3, 4, 1]);
  });

  it('RecordingEventPublisher records in order', async () => {
    const p = new RecordingEventPublisher();
    await p.publish(1, 'session');
    await p.publish(2, 'participants');
    expect(p.events).toEqual([{ sessionId: 1, type: 'session' }, { sessionId: 2, type: 'participants' }]);
  });
});
