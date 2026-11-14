import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { appMeta } from '../db/schema.js';
import { createTestApp, loginAsMentor, TEST_PASSWORD } from '../test/helpers.js';

const probe = async (s: import('fastify').FastifyInstance) => { s.get('/probe', async () => ({ secret: 1 })); };
const post = (app: Awaited<ReturnType<typeof createTestApp>>['app'], url: string, payload?: unknown, headers?: Record<string, string>) =>
  app.inject({ method: 'POST', url, payload: payload as object, headers });
const cookieOf = (res: { cookies: { name: string; value: string }[] }) => `pq_admin=${res.cookies.find(c => c.name === 'pq_admin')!.value}`;

describe('mentor auth', () => {
  it('setup → loggedIn → logout → not loggedIn → login', async () => {
    const { app } = await createTestApp();
    expect((await app.inject({ url: '/api/admin/status' })).json()).toEqual({ setupDone: false, loggedIn: false });

    const setup = await post(app, '/api/admin/setup', { password: 'secret1' });
    expect(setup.statusCode).toBe(200);
    const cookie = cookieOf(setup);
    expect((await app.inject({ url: '/api/admin/status', headers: { cookie } })).json()).toEqual({ setupDone: true, loggedIn: true });

    await post(app, '/api/admin/logout', undefined, { cookie });
    expect((await app.inject({ url: '/api/admin/status', headers: { cookie } })).json()).toEqual({ setupDone: true, loggedIn: false });

    const login = await post(app, '/api/admin/login', { password: 'secret1' });
    expect(login.statusCode).toBe(200);
    expect((await app.inject({ url: '/api/admin/status', headers: { cookie: cookieOf(login) } })).json().loggedIn).toBe(true);
  });

  it('setup twice → 409; password shorter than 6 → 400', async () => {
    const { app } = await createTestApp();
    expect((await post(app, '/api/admin/setup', { password: '12345' })).statusCode).toBe(400);
    expect((await post(app, '/api/admin/setup', {})).statusCode).toBe(400);
    expect((await post(app, '/api/admin/setup', { password: '123456' })).statusCode).toBe(200);
    expect((await post(app, '/api/admin/setup', { password: 'another1' })).statusCode).toBe(409);
  });

  it('wrong password → 401 with a generic message', async () => {
    const { app } = await createTestApp();
    await post(app, '/api/admin/setup', { password: 'secret1' });
    const res = await post(app, '/api/admin/login', { password: 'nope-nope' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Sai mật khẩu' });
    expect((await post(app, '/api/admin/login', {})).statusCode).toBe(401);
  });

  it('login before setup → 401 (does not reveal setup state)', async () => {
    const { app } = await createTestApp();
    expect((await post(app, '/api/admin/login', { password: 'whatever' })).json()).toEqual({ error: 'Sai mật khẩu' });
  });

  it('protected route: 401 without cookie, 200 with cookie, 401 with a forged cookie', async () => {
    const { app } = await createTestApp({ adminRoutes: [probe] });
    expect((await app.inject({ url: '/api/admin/probe' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/admin/probe', headers: { cookie: 'pq_admin=forged' } })).statusCode).toBe(401);
    const headers = await loginAsMentor(app);
    const ok = await app.inject({ url: '/api/admin/probe', headers });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ secret: 1 });
  });

  it('auth cookie is httpOnly and SameSite=Lax', async () => {
    const { app } = await createTestApp();
    const res = await post(app, '/api/admin/setup', { password: 'secret1' });
    expect(res.cookies[0]).toMatchObject({ name: 'pq_admin', httpOnly: true, sameSite: 'Lax' });
  });

  it('stores only a salted scrypt hash and never echoes the password', async () => {
    const { app, db } = await createTestApp();
    const res = await post(app, '/api/admin/setup', { password: TEST_PASSWORD });
    expect(res.body).not.toContain(TEST_PASSWORD);
    const stored = db.select().from(appMeta).where(eq(appMeta.key, 'admin_password_hash')).get()!.value;
    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(stored).not.toContain(TEST_PASSWORD);
  });
});
