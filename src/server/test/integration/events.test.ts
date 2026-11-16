import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { bus } from '../../infrastructure/events/event-bus.js';
import { createTestApp } from '../helpers.js';

let app: FastifyInstance;
afterEach(async () => { await app?.close(); });

async function start() {
  ({ app } = await createTestApp());
  const base = await app.listen({ port: 0, host: '127.0.0.1' });
  return base;
}

// Open an SSE stream and expose what has been received so far.
async function connect(base: string, sessionId: number) {
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/sessions/${sessionId}/events`, { signal: ctrl.signal });
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const pump = (async () => { try { for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value); } } catch { /* aborted */ } })();
  const waitFor = async (text: string, ms = 1000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (buf.includes(text)) return true; await new Promise(r => setTimeout(r, 10)); }
    return false;
  };
  return { res, text: () => buf, waitFor, close: async () => { ctrl.abort(); await pump; } };
}

describe('GET /api/sessions/:id/events', () => {
  it('sends SSE headers and an initial flush', async () => {
    const base = await start();
    const c = await connect(base, 1);
    expect(c.res.headers.get('content-type')).toBe('text/event-stream');
    expect(c.res.headers.get('cache-control')).toContain('no-cache');
    expect(await c.waitFor(': connected')).toBe(true);
    await c.close();
  });

  it('two clients of a session receive the event with an empty payload; another session does not', async () => {
    const base = await start();
    const [a, b, other] = await Promise.all([connect(base, 7), connect(base, 7), connect(base, 8)]);
    await a.waitFor(': connected'); await b.waitFor(': connected'); await other.waitFor(': connected');
    bus.publish(7, 'participants');
    expect(await a.waitFor('event: participants\ndata: {}\n\n')).toBe(true);
    expect(await b.waitFor('event: participants\ndata: {}\n\n')).toBe(true);
    await new Promise(r => setTimeout(r, 100));
    expect(other.text()).not.toContain('event:');
    await Promise.all([a.close(), b.close(), other.close()]);
  });

  it('removes the listener when the client disconnects', async () => {
    const base = await start();
    const c = await connect(base, 21);
    await c.waitFor(': connected');
    expect(bus.listenerCount(21)).toBe(1);
    await c.close();
    for (let i = 0; i < 50 && bus.listenerCount(21) > 0; i++) await new Promise(r => setTimeout(r, 20));
    expect(bus.listenerCount(21)).toBe(0);
  });

  it('rejects a non-numeric session id', async () => {
    ({ app } = await createTestApp());
    expect((await app.inject({ url: '/api/sessions/abc/events' })).statusCode).toBe(404);
  });
});
