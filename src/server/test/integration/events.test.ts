import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { bus } from '../../infrastructure/events/event-bus.js';
import { createTestApp, loginAsMentor } from '../helpers.js';

let app: FastifyInstance;
afterEach(async () => { await app?.close(); });

async function start() {
  ({ app } = await createTestApp());
  const base = await app.listen({ port: 0, host: '127.0.0.1' });
  return base;
}

// Open an SSE stream and expose what has been received so far.
async function connect(base: string, sessionId: number | 'admin', headers: Record<string, string> = {}) {
  const ctrl = new AbortController();
  const url = sessionId === 'admin' ? `${base}/api/admin/events` : `${base}/api/sessions/${sessionId}/events`;
  const res = await fetch(url, { signal: ctrl.signal, headers });
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

describe('GET /api/admin/events (the mentor\'s single stream)', () => {
  it('needs the mentor cookie', async () => {
    ({ app } = await createTestApp());
    expect((await app.inject({ url: '/api/admin/events' })).statusCode).toBe(401);
  });

  it('carries every session\'s signals with the session id, over ONE connection', async () => {
    ({ app } = await createTestApp());
    const headers = await loginAsMentor(app);
    const base = await app.listen({ port: 0, host: '127.0.0.1' });
    const c = await connect(base, 'admin', headers as Record<string, string>);
    expect(c.res.headers.get('content-type')).toBe('text/event-stream');
    await c.waitFor(': connected');
    bus.publish(31, 'participants');
    bus.publish(32, 'session');
    expect(await c.waitFor('event: participants\ndata: {"sessionId":31}\n\n')).toBe(true);
    expect(await c.waitFor('event: session\ndata: {"sessionId":32}\n\n')).toBe(true);
    expect(bus.allListenerCount()).toBe(1);
    await c.close();
    for (let i = 0; i < 50 && bus.allListenerCount() > 0; i++) await new Promise(r => setTimeout(r, 20));
    expect(bus.allListenerCount()).toBe(0);
  });

  it('also carries AI training signals as `training` with the training id, and creating a training sends one', async () => {
    ({ app } = await createTestApp());
    const headers = await loginAsMentor(app);
    const base = await app.listen({ port: 0, host: '127.0.0.1' });
    const c = await connect(base, 'admin', headers as Record<string, string>);
    await c.waitFor(': connected');
    const created = (await app.inject({ method: 'POST', url: '/api/admin/trainings', headers, payload: { name: 'Buổi 1' } })).json<{ id: number }>();
    expect(await c.waitFor(`event: training\ndata: {"trainingId":${created.id}}\n\n`)).toBe(true);
    await c.close();
    for (let i = 0; i < 50 && bus.trainingListenerCount() > 0; i++) await new Promise(r => setTimeout(r, 20));
    expect(bus.trainingListenerCount()).toBe(0);
  });
});
