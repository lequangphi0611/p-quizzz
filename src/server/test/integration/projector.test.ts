import { describe, expect, it } from 'vitest';
import type { NetworkInfo, PublicParticipant } from '../../../shared/api/index.js';
import { joinHosts } from '../../interface/http/network-routes.js';
import { createTestApp } from '../helpers.js';
import { world } from '../world.js';

describe('GET /api/sessions/:id/participants (public)', () => {
  it('returns only the names of active members, in join order — no id, token or status', async () => {
    const w = await world({ state: 'lobby' }); // "An" is already in
    await w.join('Bình');
    await w.join('Chi');
    await w.admin(`/sessions/${w.session.id}/start`);
    await w.join('Trễ'); // pending: must not show
    const detail = (await w.app.inject({ url: `/api/admin/sessions/${w.session.id}`, headers: w.headers })).json<{ participants: { id: number; displayName: string }[] }>();
    await w.admin(`/participants/${detail.participants.find(p => p.displayName === 'Chi')!.id}/kick`); // kicked: must not show

    const res = await w.app.inject({ url: `/api/sessions/${w.session.id}/participants` }); // no cookie, no token
    expect(res.statusCode).toBe(200);
    const body = res.json<PublicParticipant[]>();
    expect(body).toEqual([{ displayName: 'An' }, { displayName: 'Bình' }]);
    for (const p of body) expect(Object.keys(p)).toEqual(['displayName']);
    expect(res.body).not.toMatch(/token|"id"|status|joinedAt/);
  });

  it('404 for an unknown or malformed session', async () => {
    const { app } = await createTestApp();
    expect((await app.inject({ url: '/api/sessions/999/participants' })).statusCode).toBe(404);
    expect((await app.inject({ url: '/api/sessions/abc/participants' })).statusCode).toBe(404);
  });

  it('is open to LAN machines (not part of the mentor-only area)', async () => {
    const w = await world({ state: 'lobby' });
    const res = await w.app.inject({ url: `/api/sessions/${w.session.id}/participants`, remoteAddress: '192.168.1.50' });
    expect(res.statusCode).toBe(200);
  });
});

describe('GET /api/network (public)', () => {
  const net = async (hostHeader: string, lanIps: string[]) => {
    const { app } = await createTestApp({ lanIps: () => lanIps });
    return (await app.inject({ url: '/api/network', headers: { host: hostHeader } })).json<NetworkInfo>();
  };

  it('lists LAN address:port using the port the request arrived on', async () => {
    expect(await net('localhost:3000', ['192.168.1.24'])).toEqual({ joinHosts: ['192.168.1.24:3000'] });
    expect(await net('192.168.1.24:5173', ['192.168.1.24', '10.0.0.7'])).toEqual({ joinHosts: ['192.168.1.24:5173', '10.0.0.7:5173'] });
  });
  it('leaves the port off when it is the default 80, and is empty without a LAN address', async () => {
    expect(await net('example.local', ['192.168.1.24'])).toEqual({ joinHosts: ['192.168.1.24'] });
    expect(await net('localhost:3000', [])).toEqual({ joinHosts: [] });
  });
  it('is open to LAN machines', async () => {
    const { app } = await createTestApp({ lanIps: () => ['192.168.1.24'] });
    expect((await app.inject({ url: '/api/network', remoteAddress: '192.168.1.50' })).statusCode).toBe(200);
  });
});

describe('joinHosts', () => {
  it('falls back to the given port for a missing or malformed Host header', () => {
    expect(joinHosts(['10.0.0.1'], undefined, 3000)).toEqual(['10.0.0.1:3000']);
    expect(joinHosts(['10.0.0.1'], 'not a host!!', 3000)).toEqual(['10.0.0.1:3000']);
  });
});
