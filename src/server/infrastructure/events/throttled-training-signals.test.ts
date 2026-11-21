import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingTrainingSignals } from '../../application/testing/fakes.js';
import { ThrottledTrainingSignals } from './throttled-training-signals.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = () => {
  const inner = new RecordingTrainingSignals();
  return { inner, throttled: new ThrottledTrainingSignals(inner, 2000, () => Date.now()) };
};

describe('ThrottledTrainingSignals', () => {
  it('the first signal goes out at once', async () => {
    const { inner, throttled } = setup();
    await throttled.signal(1);
    expect(inner.signals).toEqual([1]);
  });

  it('50 signals in one second: one at once, one more when the window ends, nothing else', async () => {
    const { inner, throttled } = setup();
    for (let i = 0; i < 50; i++) {
      await throttled.signal(1);
      vi.advanceTimersByTime(20);
    }
    expect(inner.signals).toEqual([1]);
    vi.advanceTimersByTime(2000);
    expect(inner.signals).toEqual([1, 1]);
    vi.advanceTimersByTime(10_000);
    expect(inner.signals).toEqual([1, 1]);
  });

  it('a signal after a quiet window goes out at once again', async () => {
    const { inner, throttled } = setup();
    await throttled.signal(1);
    vi.advanceTimersByTime(2000);
    await throttled.signal(1);
    expect(inner.signals).toEqual([1, 1]);
  });

  it('keeps one stream per training', async () => {
    const { inner, throttled } = setup();
    await throttled.signal(1);
    await throttled.signal(2);
    await throttled.signal(1);
    expect(inner.signals).toEqual([1, 2]);
    vi.advanceTimersByTime(2000);
    expect(inner.signals).toEqual([1, 2, 1]);
  });

  it('under sustained load it sends at most one signal per window', async () => {
    const { inner, throttled } = setup();
    for (let t = 0; t < 10_000; t += 100) {
      await throttled.signal(1);
      vi.advanceTimersByTime(100);
    }
    expect(inner.signals.length).toBeLessThanOrEqual(6);
    expect(inner.signals.length).toBeGreaterThanOrEqual(4);
  });
});
