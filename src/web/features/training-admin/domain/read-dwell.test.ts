import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { READ_DWELL_MS, ReadDwell } from './read-dwell.js';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const setup = () => {
  const read: [string, number][] = [];
  return { read, dwell: new ReadDwell((k, id) => read.push([k, id])) };
};
const view = (...entries: [string, number][]) => new Map(entries);

describe('ReadDwell: 2 seconds in view', () => {
  it('reads a card that stays in view for 2 seconds, not before', () => {
    const { read, dwell } = setup();
    dwell.update(view(['a', 10]), true);
    vi.advanceTimersByTime(READ_DWELL_MS - 1);
    expect(read).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(read).toEqual([['a', 10]]);
  });
  it('leaving the view resets the clock to zero', () => {
    const { read, dwell } = setup();
    dwell.update(view(['a', 10]), true);
    vi.advanceTimersByTime(1500);
    dwell.update(view(), true);
    dwell.update(view(['a', 10]), true);
    vi.advanceTimersByTime(1500);
    expect(read).toEqual([]);
    vi.advanceTimersByTime(500);
    expect(read).toEqual([['a', 10]]);
  });
  it('does not count while the tab is hidden, the window is not focused or the content is hidden (canCount false)', () => {
    const { read, dwell } = setup();
    dwell.update(view(['a', 10]), false);
    vi.advanceTimersByTime(5000);
    expect(read).toEqual([]);
    dwell.update(view(['a', 10]), true);
    vi.advanceTimersByTime(1000);
    dwell.update(view(['a', 10]), false); // the window lost focus
    vi.advanceTimersByTime(5000);
    expect(read).toEqual([]);
    expect(dwell.counting).toEqual([]);
  });
  it('an update that keeps the card in view does not restart its clock', () => {
    const { read, dwell } = setup();
    dwell.update(view(['a', 10]), true);
    vi.advanceTimersByTime(1000);
    dwell.update(view(['a', 10]), true);
    vi.advanceTimersByTime(1000);
    expect(read).toEqual([['a', 10]]);
  });
  it('reads up to the id the card held when counting started: an event that arrives meanwhile stays new', () => {
    const { read, dwell } = setup();
    dwell.update(view(['a', 10]), true);
    vi.advanceTimersByTime(1000);
    dwell.update(view(['a', 12]), true); // a new event in the same card
    vi.advanceTimersByTime(1000);
    expect(read).toEqual([['a', 10]]);
    // still unread, so the page keeps reporting it and it is counted again
    dwell.update(view(['a', 12]), true);
    vi.advanceTimersByTime(READ_DWELL_MS);
    expect(read).toEqual([['a', 10], ['a', 12]]);
  });
  it('counts each card on its own clock', () => {
    const { read, dwell } = setup();
    dwell.update(view(['a', 1]), true);
    vi.advanceTimersByTime(1000);
    dwell.update(view(['a', 1], ['b', 2]), true);
    vi.advanceTimersByTime(1000);
    expect(read).toEqual([['a', 1]]);
    vi.advanceTimersByTime(1000);
    expect(read).toEqual([['a', 1], ['b', 2]]);
  });
  it('dispose stops everything', () => {
    const { read, dwell } = setup();
    dwell.update(view(['a', 1]), true);
    dwell.dispose();
    vi.advanceTimersByTime(5000);
    expect(read).toEqual([]);
  });
});
