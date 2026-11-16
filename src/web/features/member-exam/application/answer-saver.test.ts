import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnswerSaver, type AnswerPayload, type SaveState } from './answer-saver.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(impl?: (q: number, p: AnswerPayload) => Promise<void>) {
  const sent: [number, AnswerPayload][] = [];
  const states: SaveState[] = [];
  const send = vi.fn(async (q: number, p: AnswerPayload) => { sent.push([q, p]); await impl?.(q, p); });
  const saver = new AnswerSaver(send, s => states.push(s), 500);
  return { saver, sent, states, send };
}
const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

describe('AnswerSaver', () => {
  it('sends a choice immediately', async () => {
    const { saver, sent } = setup();
    saver.queue(1, { selectedOptionIds: [3] });
    await tick();
    expect(sent).toEqual([[1, { selectedOptionIds: [3] }]]);
    expect(saver.state).toBe('saved');
  });

  it('waits for a quiet period before sending typed text, and collapses rapid edits into one request', async () => {
    const { saver, sent } = setup();
    for (const t of ['a', 'ab', 'abc']) { saver.queue(1, { textAnswer: t }, true); await tick(200); }
    expect(sent).toEqual([]); // still within 500ms of the last keystroke
    expect(saver.state).toBe('saving');
    await tick(500);
    expect(sent).toEqual([[1, { textAnswer: 'abc' }]]);
    expect(saver.state).toBe('saved');
  });

  it('keeps questions independent', async () => {
    const { saver, sent } = setup();
    saver.queue(1, { textAnswer: 'x' }, true);
    saver.queue(2, { selectedOptionIds: [9] });
    await tick();
    expect(sent).toEqual([[2, { selectedOptionIds: [9] }]]);
    await tick(500);
    expect(sent).toHaveLength(2);
  });

  it('never has two requests in flight for one question; the newest value is sent last', async () => {
    let release!: () => void;
    let inFlight = 0, maxInFlight = 0;
    const { saver, sent } = setup(async () => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      if (sent.length === 1) await new Promise<void>(r => (release = r)); // hold the first one open
      inFlight--;
    });
    saver.queue(1, { selectedOptionIds: [1] });
    await tick();
    saver.queue(1, { selectedOptionIds: [2] }); // arrives while #1 is still in flight
    saver.queue(1, { selectedOptionIds: [3] });
    await tick();
    expect(sent).toHaveLength(1);
    release();
    await tick();
    expect(sent.map(s => s[1])).toEqual([{ selectedOptionIds: [1] }, { selectedOptionIds: [3] }]); // [2] was superseded
    expect(maxInFlight).toBe(1);
    expect(saver.state).toBe('saved');
  });

  it('a failed save puts the state in error and keeps the value for a retry', async () => {
    let fail = true;
    const { saver, sent, states } = setup(async () => { if (fail) throw new Error('offline'); });
    saver.queue(1, { selectedOptionIds: [5] });
    await tick();
    expect(saver.state).toBe('error');
    expect(states).toContain('error');
    fail = false;
    expect(await saver.retry()).toBe(true);
    expect(saver.state).toBe('saved');
    expect(sent.at(-1)).toEqual([1, { selectedOptionIds: [5] }]); // the same value went out again
  });

  it('retry reports failure while still offline', async () => {
    const { saver } = setup(async () => { throw new Error('offline'); });
    saver.queue(1, { textAnswer: 'x' });
    await tick();
    expect(await saver.retry()).toBe(false);
    expect(saver.state).toBe('error');
  });

  it('after an error, a newer edit is sent and clears the error when it succeeds', async () => {
    let fail = true;
    const { saver } = setup(async () => { if (fail) throw new Error('offline'); });
    saver.queue(1, { selectedOptionIds: [1] });
    await tick();
    expect(saver.state).toBe('error');
    fail = false;
    saver.queue(1, { selectedOptionIds: [2] });
    await tick();
    expect(saver.state).toBe('saved');
  });

  it('flushAll sends pending debounced text right away and resolves true', async () => {
    const { saver, sent } = setup();
    saver.queue(1, { textAnswer: 'draft' }, true);
    expect(sent).toEqual([]);
    expect(await saver.flushAll()).toBe(true);
    expect(sent).toEqual([[1, { textAnswer: 'draft' }]]);
    await tick(1000);
    expect(sent).toHaveLength(1); // the cancelled timer does not send a duplicate
  });

  it('flushAll resolves false when something could not be saved', async () => {
    const { saver } = setup(async () => { throw new Error('offline'); });
    saver.queue(1, { textAnswer: 'x' }, true);
    expect(await saver.flushAll()).toBe(false);
  });

  it('flushAll with nothing pending is a no-op', async () => {
    const { saver, send } = setup();
    expect(await saver.flushAll()).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it('dispose cancels pending timers and stops notifying', async () => {
    const { saver, send, states } = setup();
    saver.queue(1, { textAnswer: 'x' }, true);
    const before = states.length;
    saver.dispose();
    await tick(1000);
    expect(send).not.toHaveBeenCalled();
    expect(states.length).toBe(before);
  });

  it('retries a failed save by itself with backoff, without the member doing anything', async () => {
    let fail = true;
    const { saver, sent } = setup(async () => { if (fail) throw new Error('server down'); });
    saver.queue(1, { selectedOptionIds: [7] });
    await tick();
    expect(saver.state).toBe('error');
    const attempts = sent.length;
    await tick(2000); // first retry after 2s, still down
    expect(sent.length).toBeGreaterThan(attempts);
    expect(saver.state).toBe('error');
    fail = false; // server is back
    await tick(5000);
    expect(saver.state).toBe('saved');
    expect(sent.at(-1)).toEqual([1, { selectedOptionIds: [7] }]);
    const n = sent.length;
    await tick(30000); // no further traffic once saved
    expect(sent.length).toBe(n);
  });

  it('dispose stops the automatic retries', async () => {
    const { saver, sent } = setup(async () => { throw new Error('down'); });
    saver.queue(1, { textAnswer: 'x' });
    await tick();
    saver.dispose();
    const n = sent.length;
    await tick(60000);
    expect(sent.length).toBe(n);
  });
});
