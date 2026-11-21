import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { CreatedTraining, HookConfig, MyTraining, ResolvedRoom, TrainingDetail, TrainingSummary } from '../../../shared/api/index.js';
import { createJoinLimiter } from '../../interface/http/join-limiter.js';
import { trainingEvents, trainingMembers, trainings } from '../../infrastructure/db/schema.js';
import Fastify from 'fastify';
import { registerLeakGuard } from '../../interface/http/leak-guard.js';
import { LOCAL_ONLY_MESSAGE } from '../../interface/http/auth/require-local.js';
import { createTestApp, loginAsMentor, roomCodeOf, seedExam } from '../helpers.js';
import { allKeys } from '../world.js';

const LAN = '192.168.1.50';

async function setup(opts: Parameters<typeof createTestApp>[0] = {}) {
  const { app, db, composition } = await createTestApp(opts);
  const headers = await loginAsMentor(app);
  const admin = (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object) => app.inject({ method, url: `/api/admin${url}`, headers, payload });
  const create = async (name = 'Buổi 1') => (await admin('POST', '/trainings', { name })).json<CreatedTraining>();
  const detail = async (id: number) => (await admin('GET', `/trainings/${id}`)).json<TrainingDetail>();
  const resolve = (roomCode: string, remoteAddress = LAN) => app.inject({ method: 'POST', url: '/api/rooms/resolve', payload: { roomCode }, remoteAddress });
  const join = (id: number, body: unknown, remoteAddress = LAN) => app.inject({ method: 'POST', url: `/api/trainings/${id}/join`, payload: body as object, remoteAddress });
  const joined = async (t: CreatedTraining, displayName: string) => {
    const res = await join(t.id, { displayName, roomCode: t.roomCode, consent: true });
    expect(res.statusCode, res.body).toBe(201);
    return res.json<{ token: string }>().token;
  };
  const me = (token: string, path = '', method: 'GET' | 'DELETE' = 'GET', host?: string) =>
    app.inject({ method, url: `/api/training/me${path}`, headers: { 'x-training-member-token': token, ...(host ? { host } : {}) }, remoteAddress: LAN });
  return { app, db, composition, headers, admin, create, detail, resolve, join, joined, me };
}

describe('mentor: create, list, detail', () => {
  it('creates an open training with a 6-digit code; the list is newest first', async () => {
    const s = await setup();
    const a = await s.create('Buổi 1');
    expect(a).toMatchObject({ name: 'Buổi 1', status: 'open', memberCount: 0 });
    expect(a.roomCode).toMatch(/^\d{6}$/);
    const b = await s.create('Buổi 2');
    const list = (await s.admin('GET', '/trainings')).json<TrainingSummary[]>();
    expect(list.map(t => t.name)).toEqual(['Buổi 2', 'Buổi 1']);
    expect(list[0]).toMatchObject({ id: b.id, status: 'open', stoppedAt: null, endedAt: null, memberCount: 0 });
  });

  it('validates the name (1–100 characters)', async () => {
    const s = await setup();
    for (const name of ['', '   ', 'x'.repeat(101), 5, undefined]) expect((await s.admin('POST', '/trainings', { name } as object)).statusCode, String(name)).toBe(400);
  });

  it('detail shows the code only while open, members as waiting, and 404 for an unknown id', async () => {
    const s = await setup();
    const t = await s.create();
    await s.joined(t, 'Lan');
    const d = await s.detail(t.id);
    expect(d).toMatchObject({ id: t.id, status: 'open', roomCode: t.roomCode, uninstalled: null });
    expect(d.members).toEqual([expect.objectContaining({ displayName: 'Lan', connection: 'waiting', promptCount: 0, toolCount: 0, failedCount: 0, stuck: false, stillSending: false, lastSeenAt: null })]);
    expect((await s.admin('GET', '/trainings/999')).statusCode).toBe(404);
    expect((await s.admin('GET', '/trainings/abc')).statusCode).toBe(404);
  });

  it('is on the mentor machine only: another LAN machine gets 403', async () => {
    const s = await setup();
    for (const [method, url] of [['GET', '/api/admin/trainings'], ['POST', '/api/admin/trainings'], ['GET', '/api/admin/trainings/1'], ['POST', '/api/admin/trainings/1/stop'], ['POST', '/api/admin/trainings/1/end'], ['DELETE', '/api/admin/trainings/1/members/1']] as const) {
      const res = await s.app.inject({ method, url, headers: s.headers, remoteAddress: LAN, payload: method === 'POST' ? { name: 'x' } : undefined });
      expect(res.statusCode, url).toBe(403);
      expect(res.json()).toEqual({ error: LOCAL_ONLY_MESSAGE });
    }
  });
});

describe('room code space shared with sessions', () => {
  it('resolve answers kind: training for a training code and kind: session for a session code', async () => {
    const s = await setup();
    const exam = seedExam(s.db, { hasEssay: false });
    const sess = (await s.admin('POST', '/sessions', { examId: exam.id })).json<{ id: number }>();
    await s.admin('POST', `/sessions/${sess.id}/open`);
    const t = await s.create('Học Claude Code');

    expect((await s.resolve(t.roomCode)).json<ResolvedRoom>()).toEqual({ kind: 'training', id: t.id, title: 'Học Claude Code' });
    const room = (await s.resolve(roomCodeOf(s.app, sess.id))).json<ResolvedRoom>();
    expect(room).toMatchObject({ kind: 'session', id: sess.id });
  });

  it('a session never gets the code of an open training, and a training never gets a session code', async () => {
    const s = await setup();
    const t = await s.create();
    // Force the session opener to draw the training's code first: the second draw must differ.
    const exam = seedExam(s.db, { hasEssay: false });
    for (let i = 0; i < 5; i++) {
      const sess = (await s.admin('POST', '/sessions', { examId: exam.id })).json<{ id: number }>();
      await s.admin('POST', `/sessions/${sess.id}/open`);
      expect(roomCodeOf(s.app, sess.id)).not.toBe(t.roomCode);
    }
    const codes = new Set<string>();
    for (let i = 0; i < 5; i++) codes.add((await s.create(`T${i}`)).roomCode);
    expect(codes.size).toBe(5);
  });

  it('the database refuses two trainings with one code', async () => {
    const s = await setup();
    const t = await s.create();
    expect(() => s.db.insert(trainings).values({ name: 'dup', roomCode: t.roomCode, createdAt: new Date() }).run()).toThrow();
  });
});

describe('member: resolve, join, me', () => {
  it('a wrong code or a stopped training answers the old 403 and counts against the shared limit', async () => {
    const limiter = createJoinLimiter({ max: 2 });
    const s = await setup({ joinLimiter: limiter });
    const t = await s.create();
    expect((await s.resolve('000000')).statusCode).toBe(403);
    await s.admin('POST', `/trainings/${t.id}/stop`);
    const stopped = await s.resolve(t.roomCode);
    expect(stopped.statusCode).toBe(403);
    expect(stopped.json()).toEqual({ error: 'Mã phòng không đúng' });
    expect((await s.resolve('000000')).statusCode).toBe(429); // two failures used the budget
  });

  it('join needs consent: true (400 otherwise), the right code (403), a free name (409 identity_in_use)', async () => {
    const s = await setup();
    const t = await s.create();
    const body = { displayName: 'Lan', roomCode: t.roomCode };
    expect((await s.join(t.id, body)).statusCode).toBe(400);
    expect((await s.join(t.id, { ...body, consent: false })).statusCode).toBe(400);
    expect((await s.join(t.id, { ...body, consent: 'true' })).statusCode).toBe(400);
    expect((await s.join(t.id, { ...body, roomCode: '000000', consent: true })).statusCode).toBe(403);
    expect(s.db.select().from(trainingMembers).all()).toHaveLength(0); // nobody exists without consent

    const ok = await s.join(t.id, { ...body, consent: true });
    expect(ok.statusCode).toBe(201);
    expect(ok.json()).toEqual({ token: expect.any(String), member: { displayName: 'Lan' } });
    const dup = await s.join(t.id, { displayName: ' lan ', roomCode: `${t.roomCode.slice(0, 3)} ${t.roomCode.slice(3)}`, consent: true });
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toMatchObject({ code: 'identity_in_use' });
    expect((await s.join(999, { ...body, consent: true })).statusCode).toBe(403); // unknown training: the same neutral 403
  });

  it('join is refused (neutral 403) once the training is stopped', async () => {
    const s = await setup();
    const t = await s.create();
    await s.admin('POST', `/trainings/${t.id}/stop`);
    expect((await s.join(t.id, { displayName: 'Lan', roomCode: t.roomCode, consent: true })).statusCode).toBe(403);
  });

  it('GET /api/training/me is status only: no collected-data keys, no ingest token', async () => {
    const s = await setup();
    const t = await s.create();
    const token = await s.joined(t, 'Lan');
    const res = await s.me(token);
    expect(res.statusCode).toBe(200);
    expect(res.json<MyTraining>()).toEqual({ training: { id: t.id, name: 'Buổi 1', status: 'open' }, member: { displayName: 'Lan', connection: 'waiting', uninstallCheck: 'none' } });
    const keys = allKeys(res.json());
    for (const k of ['prompt', 'toolTarget', 'summary', 'output', 'change', 'events', 'ingestToken']) expect(keys.has(k), k).toBe(false);
    const ingest = s.db.select().from(trainingMembers).get()!.ingestToken;
    expect(res.body).not.toContain(ingest);
  });

  it('an unknown or missing token is 401', async () => {
    const s = await setup();
    expect((await s.me('nope')).statusCode).toBe(401);
    expect((await s.app.inject({ url: '/api/training/me', remoteAddress: LAN })).statusCode).toBe(401);
  });
});

describe('hook-config', () => {
  it('has the eight hooks (http, timeout 1, token header, URL from the request Host) and no Stop', async () => {
    const s = await setup();
    const t = await s.create();
    const token = await s.joined(t, 'Lan');
    const ingest = s.db.select().from(trainingMembers).get()!.ingestToken;
    expect(ingest).not.toBe(token);

    const res = await s.me(token, '/hook-config', 'GET', '192.168.1.5:3000');
    expect(res.statusCode).toBe(200);
    const cfg = res.json<HookConfig>();
    expect(Object.keys(cfg.settings.hooks).sort()).toEqual([
      'Notification', 'PermissionRequest', 'PostModelSwitch', 'PostToolUse', 'PostToolUseFailure', 'PreCompact', 'SessionEnd', 'UserPromptSubmit',
    ]);
    for (const entries of Object.values(cfg.settings.hooks)) {
      expect(entries[0]!.hooks).toEqual([{ type: 'http', url: 'http://192.168.1.5:3000/api/training/ingest', headers: { 'X-Training-Token': ingest }, timeout: 1 }]);
    }
    expect(res.body).not.toContain('"Stop"');
    expect(cfg.mergePrompt).toContain('.claude/settings.local.json');
    expect(cfg.mergePrompt).toContain(ingest);
    expect(res.body).not.toContain('"ingestToken"');
  });

  it('is 409 once the training is not open', async () => {
    const s = await setup();
    const t = await s.create();
    const token = await s.joined(t, 'Lan');
    await s.admin('POST', `/trainings/${t.id}/stop`);
    expect((await s.me(token, '/hook-config')).statusCode).toBe(409);
  });
});

describe('stop and end', () => {
  it('stop makes the code useless at once; end deletes members and events but keeps name, times and the count', async () => {
    const s = await setup();
    const t = await s.create('Buổi cuối');
    const lan = await s.joined(t, 'Lan');
    await s.joined(t, 'Mai');
    const memberId = s.db.select().from(trainingMembers).where(eq(trainingMembers.displayName, 'Lan')).get()!.id;
    s.db.insert(trainingEvents).values({ memberId, kind: 'prompt', claudeSessionId: 'c1', receivedAt: new Date(), prompt: 'hello' }).run();

    const stopped = await s.admin('POST', `/trainings/${t.id}/stop`);
    expect(stopped.statusCode).toBe(200);
    expect(stopped.json<TrainingDetail>()).toMatchObject({ status: 'stopped', roomCode: null, uninstalled: { count: 0, total: 2 } });
    expect(s.db.select().from(trainings).get()!.roomCode).toBeNull();
    expect((await s.resolve(t.roomCode)).statusCode).toBe(403);
    expect((await s.me(lan)).json<MyTraining>().training.status).toBe('stopped');

    const ended = await s.admin('POST', `/trainings/${t.id}/end`);
    expect(ended.statusCode).toBe(200);
    expect(ended.json<TrainingDetail>()).toMatchObject({ status: 'ended', name: 'Buổi cuối', members: [], roomCode: null });
    expect(s.db.select().from(trainingMembers).all()).toEqual([]);
    expect(s.db.select().from(trainingEvents).all()).toEqual([]);
    const row = (await s.admin('GET', '/trainings')).json<TrainingSummary[]>()[0]!;
    expect(row).toMatchObject({ status: 'ended', memberCount: 2 });
    expect(row.endedAt).toEqual(expect.any(Number));
    expect((await s.me(lan)).statusCode).toBe(401); // the data is gone, so is the member
  });

  it('out-of-order steps are 409', async () => {
    const s = await setup();
    const t = await s.create();
    expect((await s.admin('POST', `/trainings/${t.id}/end`)).statusCode).toBe(409);
    expect((await s.admin('POST', `/trainings/${t.id}/stop`)).statusCode).toBe(200);
    expect((await s.admin('POST', `/trainings/${t.id}/stop`)).statusCode).toBe(409);
    expect((await s.admin('POST', `/trainings/${t.id}/end`)).statusCode).toBe(200);
    expect((await s.admin('POST', `/trainings/${t.id}/end`)).statusCode).toBe(409);
    expect((await s.admin('POST', '/trainings/999/stop')).statusCode).toBe(404);
  });
});

describe('withdraw and remove', () => {
  it('withdrawing deletes the member and their events; the old token is 401', async () => {
    const s = await setup();
    const t = await s.create();
    const token = await s.joined(t, 'Lan');
    const memberId = s.db.select().from(trainingMembers).get()!.id;
    s.db.insert(trainingEvents).values({ memberId, kind: 'prompt', claudeSessionId: 'c1', receivedAt: new Date(), prompt: 'hi' }).run();

    expect((await s.me(token, '', 'DELETE')).statusCode).toBe(204);
    expect(s.db.select().from(trainingMembers).all()).toEqual([]);
    expect(s.db.select().from(trainingEvents).all()).toEqual([]);
    expect((await s.me(token)).statusCode).toBe(401);
    expect((await s.detail(t.id)).members).toEqual([]);
    // the name is free again
    expect((await s.join(t.id, { displayName: 'Lan', roomCode: t.roomCode, consent: true })).statusCode).toBe(201);
  });

  it('the mentor can send a member away: member and events deleted, token 401; 404 for a member of another training', async () => {
    const s = await setup();
    const t = await s.create('A');
    const other = await s.create('B');
    const token = await s.joined(t, 'Lan');
    const otherToken = await s.joined(other, 'Mai');
    const memberId = s.db.select().from(trainingMembers).where(eq(trainingMembers.displayName, 'Lan')).get()!.id;
    s.db.insert(trainingEvents).values({ memberId, kind: 'prompt', claudeSessionId: 'c1', receivedAt: new Date(), prompt: 'hi' }).run();

    expect((await s.admin('DELETE', `/trainings/${other.id}/members/${memberId}`)).statusCode).toBe(404);
    expect((await s.admin('DELETE', `/trainings/${t.id}/members/${memberId}`)).statusCode).toBe(204);
    expect((await s.me(token)).statusCode).toBe(401);
    expect((await s.me(otherToken)).statusCode).toBe(200);
    expect(s.db.select().from(trainingEvents).all()).toEqual([]);

    await s.admin('POST', `/trainings/${t.id}/stop`);
    await s.admin('POST', `/trainings/${t.id}/end`);
    expect((await s.admin('DELETE', `/trainings/${t.id}/members/${memberId}`)).statusCode).toBe(409);
  });
});

describe('leak guard', () => {
  // A route that wrongly returns collected data: the guard must turn it into a 500 (mounted outside /api/admin, which is exempt).
  const probeApp = async (payload: object) => {
    const probe = Fastify();
    registerLeakGuard(probe);
    probe.get('/api/training/probe', async () => payload);
    probe.get('/api/trainings/1/probe', async () => payload);
    probe.get('/api/other/probe', async () => payload);
    return probe;
  };

  it.each(['prompt', 'toolTarget', 'summary', 'output', 'change', 'events'])('%s is blocked on member training routes only', async key => {
    const p = await probeApp({ nested: { [key]: 'x' } });
    expect((await p.inject({ url: '/api/training/probe' })).statusCode).toBe(500);
    expect((await p.inject({ url: '/api/trainings/1/probe' })).statusCode).toBe(500);
    expect((await p.inject({ url: '/api/other/probe' })).statusCode).toBe(200);
  });

  it('a field named ingestToken is blocked everywhere outside /api/admin; a header-style key is not', async () => {
    const p = await probeApp({ ingestToken: 'secret' });
    for (const url of ['/api/training/probe', '/api/other/probe']) expect((await p.inject({ url })).statusCode, url).toBe(500);
    const ok = await probeApp({ headers: { 'X-Training-Token': 'secret' }, mergePrompt: 'text' });
    expect((await ok.inject({ url: '/api/training/probe' })).statusCode).toBe(200);
  });
});
