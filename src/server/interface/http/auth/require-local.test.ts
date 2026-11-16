import { networkInterfaces } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createTestApp, loginAsMentor } from '../../../test/helpers.js';
import { isLocalAddress, LOCAL_ONLY_MESSAGE } from './require-local.js';

const LAN = '192.168.1.50';
const ownLanIp = Object.values(networkInterfaces()).flat().find(n => n && n.family === 'IPv4' && !n.internal)?.address;

describe('isLocalAddress', () => {
  const none = new Set<string>();
  it('accepts loopback in every spelling', () => {
    for (const a of ['127.0.0.1', '127.0.0.5', '::1', '::ffff:127.0.0.1']) expect(isLocalAddress(a, none), a).toBe(true);
  });
  it('rejects other machines', () => {
    for (const a of [LAN, '10.0.0.7', '::ffff:192.168.1.50', 'fe80::1', '8.8.8.8']) expect(isLocalAddress(a, none), a).toBe(false);
  });
  it("accepts the machine's own interface addresses (mentor opening the app through its LAN IP)", () => {
    const own = new Set(['192.168.1.5']);
    expect(isLocalAddress('192.168.1.5', own)).toBe(true);
    expect(isLocalAddress('::ffff:192.168.1.5', own)).toBe(true);
    expect(isLocalAddress('192.168.1.6', own)).toBe(false);
  });
});

describe('/api/admin is reachable only from the mentor machine', () => {
  const from = (app: Awaited<ReturnType<typeof createTestApp>>['app'], remoteAddress: string, extra: { url?: string; method?: 'GET' | 'POST'; headers?: Record<string, string>; payload?: object } = {}) =>
    app.inject({ method: extra.method ?? 'GET', url: extra.url ?? '/api/admin/status', remoteAddress, headers: extra.headers, payload: extra.payload });

  it('a LAN machine gets 403 on every admin route — status, setup, login and protected ones', async () => {
    const { app } = await createTestApp();
    for (const [method, url] of [['GET', '/api/admin/status'], ['POST', '/api/admin/setup'], ['POST', '/api/admin/login'], ['POST', '/api/admin/logout'], ['GET', '/api/admin/exams'], ['GET', '/api/admin/sessions']] as const) {
      const res = await from(app, LAN, { method, url, payload: method === 'POST' ? { password: 'secret1' } : undefined });
      expect(res.statusCode, url).toBe(403);
      expect(res.json()).toEqual({ error: LOCAL_ONLY_MESSAGE });
    }
  });

  it('a LAN machine cannot take over the first-run password setup', async () => {
    const { app } = await createTestApp();
    expect((await from(app, LAN, { method: 'POST', url: '/api/admin/setup', payload: { password: 'attacker1' } })).statusCode).toBe(403);
    expect((await from(app, '127.0.0.1')).json()).toEqual({ setupDone: false, loggedIn: false });
  });

  it('even a valid mentor cookie is refused from a LAN machine', async () => {
    const { app } = await createTestApp();
    const headers = await loginAsMentor(app); // from the mentor machine
    expect((await from(app, '127.0.0.1', { url: '/api/admin/exams', headers })).statusCode).toBe(200);
    expect((await from(app, LAN, { url: '/api/admin/exams', headers })).statusCode).toBe(403);
  });

  it('the mentor machine works over 127.0.0.1, ::1 and IPv4-mapped loopback', async () => {
    const { app } = await createTestApp();
    for (const a of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) expect((await from(app, a)).statusCode, a).toBe(200);
  });

  it.skipIf(!ownLanIp)('the mentor machine also works through its own LAN IP', async () => {
    const { app } = await createTestApp();
    expect((await from(app, ownLanIp!)).statusCode).toBe(200);
  });

  it('a forged X-Forwarded-For from a LAN client is ignored', async () => {
    const { app } = await createTestApp();
    expect((await from(app, LAN, { headers: { 'x-forwarded-for': '127.0.0.1' } })).statusCode).toBe(403);
  });

  it('behind the dev proxy (peer is loopback) the forwarded client address decides', async () => {
    const { app } = await createTestApp();
    expect((await from(app, '127.0.0.1', { headers: { 'x-forwarded-for': LAN } })).statusCode).toBe(403);
    expect((await from(app, '127.0.0.1', { headers: { 'x-forwarded-for': '127.0.0.1' } })).statusCode).toBe(200);
    expect((await from(app, '::1', { headers: { 'x-forwarded-for': `::ffff:${LAN}` } })).statusCode).toBe(403);
  });

  it('allowRemoteAdmin opens it to LAN machines again', async () => {
    const { app } = await createTestApp({ allowRemoteAdmin: true });
    expect((await from(app, LAN)).statusCode).toBe(200);
  });

  it('member endpoints stay open to the LAN', async () => {
    const { app } = await createTestApp();
    expect((await from(app, LAN, { url: '/api/sessions/active' })).statusCode).toBe(200);
    expect((await from(app, LAN, { url: '/api/health' })).statusCode).toBe(200);
    // /api/me needs a token, but the refusal must come from auth (401), not from the local-only rule (403)
    expect((await from(app, LAN, { url: '/api/me' })).statusCode).toBe(401);
  });
});
