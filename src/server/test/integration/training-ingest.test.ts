import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { CreatedTraining, MyTraining, TrainingDetail, UninstallCheckResult } from '../../../shared/api/index.js';
import { FakeClock } from '../../application/testing/fakes.js';
import {
  ASSISTANT_ANSWER, CWD, FILE_SECRET, TRANSCRIPT,
  WIN_CWD, postToolUseFailurePowerShell, postToolUsePowerShell,
  postToolUseBash, postToolUseEdit, postToolUseFailure, postToolUseRead, postToolUseWrite, stop, userPromptSubmit,
} from '../../domain/training/fixtures/hook-payloads.js';
import { bus } from '../../infrastructure/events/event-bus.js';
import { trainingEvents, trainingMembers } from '../../infrastructure/db/schema.js';
import { UNINSTALL_CHECK_MIN_MS } from '../../domain/training/training.js';
import { STOPPED_REMINDER } from '../../interface/http/training-routes.js';
import { createTestApp, loginAsMentor } from '../helpers.js';

const LAN = '192.168.1.50';

async function setup() {
  const clock = new FakeClock(Date.now());
  const { app, db } = await createTestApp({ ports: { clock } });
  const headers = await loginAsMentor(app);
  const admin = (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object) => app.inject({ method, url: `/api/admin${url}`, headers, payload });
  const training = async () => (await admin('POST', '/trainings', { name: 'Buổi 1' })).json<CreatedTraining>();
  const detail = async (id: number) => (await admin('GET', `/trainings/${id}`)).json<TrainingDetail>();
  /** Joins with consent; returns the browser token and the token the member's hooks carry. */
  const member = async (t: CreatedTraining, displayName: string) => {
    const res = await app.inject({ method: 'POST', url: `/api/trainings/${t.id}/join`, payload: { displayName, roomCode: t.roomCode, consent: true }, remoteAddress: LAN });
    expect(res.statusCode, res.body).toBe(201);
    const token = res.json<{ token: string }>().token;
    const row = db.select().from(trainingMembers).where(eq(trainingMembers.token, token)).get()!;
    return { token, ingestToken: row.ingestToken, id: row.id };
  };
  const ingest = (token: string | undefined, payload: unknown, contentType = 'application/json') =>
    app.inject({
      method: 'POST',
      url: '/api/training/ingest',
      headers: { ...(token ? { 'x-training-token': token } : {}), 'content-type': contentType },
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
      remoteAddress: LAN,
    });
  const me = (token: string, path = '', method: 'GET' | 'POST' = 'GET') =>
    app.inject({ method, url: `/api/training/me${path}`, headers: { 'x-training-member-token': token }, remoteAddress: LAN });
  const events = () => db.select().from(trainingEvents).orderBy(trainingEvents.id).all();
  return { app, db, clock, admin, training, detail, member, ingest, me, events };
}

describe('ingest: what is kept', () => {
  it('stores each hook as the filtered event and answers 204', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    for (const p of [userPromptSubmit, postToolUseBash, postToolUseFailure, postToolUseWrite, postToolUseEdit, postToolUseRead]) {
      const res = await s.ingest(lan.ingestToken, p);
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
    }
    const rows = s.events();
    expect(rows.map(r => [r.kind, r.toolName, r.toolTarget, r.ok])).toEqual([
      ['prompt', null, null, null],
      ['tool', 'Bash', 'npm test', true],
      ['tool', 'Bash', 'ls /nope', false],
      ['tool', 'Write', 'src/add.ts', true],
      ['tool', 'Edit', 'src/add.ts', true],
      ['tool', 'Read', '.env · 2 dòng', true],
    ]);
    expect(rows[0]).toMatchObject({ prompt: 'Viết hàm cộng hai số', memberId: lan.id });
    expect(rows[1]).toMatchObject({ durationMs: 2310, outputHead: 'PASS src/add.test.ts\nTests: 3 passed', outputTail: null, outputOmittedLines: 0 });
    expect(rows[2]).toMatchObject({ ok: false, durationMs: 31, errorExcerpt: 'Exit code 2\nls: cannot access /nope: No such file or directory', outputHead: null });
    expect(rows[3]).toMatchObject({ changeHead: 'export const add = (a: number, b: number) => a + b;\n', outputHead: null });
    expect(rows[4]).toMatchObject({ changeHead: '- a + b\n+ a + b + 0' });
    expect(rows[5]).toMatchObject({ outputHead: null, changeHead: null });
  });

  it('Stop and other events store nothing and still answer 204', async () => {
    const s = await setup();
    const lan = await s.member(await s.training(), 'Lan');
    for (const p of [stop, { hook_event_name: 'SessionStart', session_id: 'x' }, {}]) expect((await s.ingest(lan.ingestToken, p)).statusCode).toBe(204);
    expect(s.events()).toEqual([]);
  });

  it('no column of any row holds the transcript path, the folder, the assistant answer or a file read', async () => {
    const s = await setup();
    const lan = await s.member(await s.training(), 'Lan');
    for (const p of [userPromptSubmit, postToolUseBash, postToolUseFailure, postToolUseWrite, postToolUseEdit, postToolUseRead, stop]) await s.ingest(lan.ingestToken, p);
    const dump = JSON.stringify(s.events());
    for (const forbidden of [TRANSCRIPT, 'transcript', CWD, '/home/lan', 'permission_mode', 'cwd', ASSISTANT_ANSWER, FILE_SECRET]) expect(dump, forbidden).not.toContain(forbidden);
    expect(dump).toContain('claudeSessionId');
  });

  it('a 10 000-line output is stored as 200 lines + 200 lines, 9 600 omitted', async () => {
    const s = await setup();
    const lan = await s.member(await s.training(), 'Lan');
    const stdout = Array.from({ length: 10_000 }, (_, i) => `dòng ${i + 1}`).join('\n');
    await s.ingest(lan.ingestToken, { ...postToolUseBash, tool_response: { stdout } });
    const row = s.events()[0]!;
    expect(row.outputOmittedLines).toBe(9600);
    expect(row.outputHead!.split('\n')).toHaveLength(200);
    expect(row.outputTail!.split('\n')).toHaveLength(200);
    expect(row.outputTail!.endsWith('dòng 10000')).toBe(true);
    expect(Buffer.byteLength(row.outputHead!)).toBeLessThanOrEqual(32 * 1024);
    expect(Buffer.byteLength(row.outputTail!)).toBeLessThanOrEqual(32 * 1024);
  });

  it('a 1 MB payload is taken in under 50 ms with one write', async () => {
    const s = await setup();
    const lan = await s.member(await s.training(), 'Lan');
    const stdout = Array.from({ length: 12_500 }, (_, i) => `${i}`.padEnd(80, 'x')).join('\n');
    const body = JSON.stringify({ ...postToolUseBash, tool_response: { stdout } });
    expect(body.length).toBeGreaterThan(1_000_000);
    await s.ingest(lan.ingestToken, body); // warm up
    const t0 = performance.now();
    const res = await s.ingest(lan.ingestToken, body);
    const ms = performance.now() - t0;
    expect(res.statusCode).toBe(204);
    expect(ms).toBeLessThan(50);
    expect(s.events()).toHaveLength(2);
  });
});

describe('ingest: PowerShell (Windows)', () => {
  it('stores the command and the output like Bash, with no trace of the Windows folder or user', async () => {
    const s = await setup();
    const lan = await s.member(await s.training(), 'Lan');
    for (const p of [postToolUsePowerShell, postToolUseFailurePowerShell]) expect((await s.ingest(lan.ingestToken, p)).statusCode).toBe(204);
    const rows = s.events();
    expect(rows.map(r => [r.toolName, r.toolTarget, r.ok])).toEqual([['PowerShell', 'Get-ChildItem src', true], ['PowerShell', 'npm test', false]]);
    expect(rows[0]).toMatchObject({ outputHead: 'src\\add.ts\nMode  Length Name\n-a--- 52 add.ts\n', durationMs: 412 });
    expect(rows[1]).toMatchObject({ errorExcerpt: "npm : The term 'npm' is not recognized\nAt line:1 char:1" });
    const dump = JSON.stringify(rows);
    for (const forbidden of [WIN_CWD, 'C:', 'C:\\\\Users', 'transcript', '\\r']) expect(dump, forbidden).not.toContain(forbidden);
  });
});

describe('ingest: odd requests', () => {
  it('a body over 2 MB is 413 and stores nothing', async () => {
    const s = await setup();
    const lan = await s.member(await s.training(), 'Lan');
    const res = await s.ingest(lan.ingestToken, JSON.stringify({ ...userPromptSubmit, prompt: 'x'.repeat(2 * 1024 * 1024 + 10) }));
    expect(res.statusCode).toBe(413);
    expect(s.events()).toEqual([]);
  });

  it('invalid JSON, a non-JSON body and an empty body are all 204, stored nowhere, never a 500', async () => {
    const s = await setup();
    const lan = await s.member(await s.training(), 'Lan');
    for (const [body, type] of [['{"prompt": ', 'application/json'], ['hello', 'text/plain'], ['', 'application/json'], ['null', 'application/json'], ['[]', 'application/json']] as const) {
      const res = await s.ingest(lan.ingestToken, body, type);
      expect(res.statusCode, `${type} ${body}`).toBe(204);
    }
    expect(s.events()).toEqual([]);
    expect((await s.me(lan.token)).json<MyTraining>().member.connection).toBe('waiting'); // junk does not make a member "connected"
  });

  it('an unknown, missing or browser token is 404 with an empty body, and the browser token never works as an ingest token', async () => {
    const s = await setup();
    const lan = await s.member(await s.training(), 'Lan');
    for (const token of ['nope', undefined, lan.token]) {
      const res = await s.ingest(token, userPromptSubmit);
      expect(res.statusCode).toBe(404);
      expect(res.body).toBe('');
    }
    expect(s.events()).toEqual([]);
  });

  it('is open to the LAN (members are not on the mentor machine) but the token is the only way in', async () => {
    const s = await setup();
    const lan = await s.member(await s.training(), 'Lan');
    const res = await s.app.inject({ method: 'POST', url: '/api/training/ingest', headers: { 'x-training-token': lan.ingestToken }, payload: userPromptSubmit, remoteAddress: '10.9.9.9' });
    expect(res.statusCode).toBe(204);
  });
});

describe('connection state', () => {
  it('the first event makes the member connected, and /me shows it on the next poll', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    expect((await s.me(lan.token)).json<MyTraining>().member.connection).toBe('waiting');
    expect((await s.detail(t.id)).members[0]).toMatchObject({ connection: 'waiting', lastSeenAt: null });

    s.clock.advance(1000);
    await s.ingest(lan.ingestToken, userPromptSubmit);
    expect((await s.me(lan.token)).json<MyTraining>().member).toMatchObject({ connection: 'connected', uninstallCheck: 'none' });
    expect((await s.detail(t.id)).members[0]).toMatchObject({ connection: 'connected', lastSeenAt: s.clock.now().getTime() });
  });

  it('the other members of the training are unaffected', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    const mai = await s.member(t, 'Mai');
    await s.ingest(lan.ingestToken, userPromptSubmit);
    expect((await s.detail(t.id)).members.map(m => [m.displayName, m.connection])).toEqual([['Lan', 'connected'], ['Mai', 'waiting']]);
    expect(mai.token).not.toBe(lan.token);
  });
});

describe('after "Dừng thu"', () => {
  it('answers 200 with a reminder, stores nothing, and the mentor sees stillSending', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.ingest(lan.ingestToken, userPromptSubmit);
    await s.admin('POST', `/trainings/${t.id}/stop`);

    const res = await s.ingest(lan.ingestToken, postToolUseBash);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ systemMessage: STOPPED_REMINDER });
    expect(STOPPED_REMINDER).toMatch(/dừng thu/);
    expect(s.events()).toHaveLength(1);
    expect((await s.detail(t.id)).members[0]).toMatchObject({ stillSending: true, connection: 'connected' });
  });

  it('an event that is not ours after the stop is 204 and does not count as still sending', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.admin('POST', `/trainings/${t.id}/stop`);
    expect((await s.ingest(lan.ingestToken, stop)).statusCode).toBe(204);
    expect((await s.detail(t.id)).members[0]!.stillSending).toBe(false);
  });

  it('once ended, or after withdrawing, the token is unknown (404)', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    const mai = await s.member(t, 'Mai');
    expect((await s.app.inject({ method: 'DELETE', url: '/api/training/me', headers: { 'x-training-member-token': mai.token }, remoteAddress: LAN })).statusCode).toBe(204);
    expect((await s.ingest(mai.ingestToken, userPromptSubmit)).statusCode).toBe(404);
    await s.admin('POST', `/trainings/${t.id}/stop`);
    await s.admin('POST', `/trainings/${t.id}/end`);
    expect((await s.ingest(lan.ingestToken, userPromptSubmit)).statusCode).toBe(404);
  });
});

describe('removal check', () => {
  const start = (s: Awaited<ReturnType<typeof setup>>, token: string) => s.me(token, '/uninstall-check', 'POST');
  const finish = (s: Awaited<ReturnType<typeof setup>>, token: string) => s.me(token, '/uninstall-check/finish', 'POST');

  it('quiet for 5 s → passed: the member is uninstalled and the mentor board counts them', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.member(t, 'Mai');
    await s.ingest(lan.ingestToken, userPromptSubmit);
    await s.admin('POST', `/trainings/${t.id}/stop`);

    expect((await start(s, lan.token)).statusCode).toBe(204);
    expect((await s.me(lan.token)).json<MyTraining>().member.uninstallCheck).toBe('waiting');
    const early = await finish(s, lan.token);
    expect(early.statusCode).toBe(409);
    expect(early.json()).toMatchObject({ code: 'too_early' });

    s.clock.advance(UNINSTALL_CHECK_MIN_MS);
    const done = await finish(s, lan.token);
    expect(done.json<UninstallCheckResult>()).toEqual({ result: 'passed' });
    expect((await s.me(lan.token)).json<MyTraining>().member).toMatchObject({ connection: 'uninstalled', uninstallCheck: 'passed' });
    const d = await s.detail(t.id);
    expect(d.uninstalled).toEqual({ count: 1, total: 2 });
    expect(d.members.find(m => m.displayName === 'Lan')).toMatchObject({ connection: 'uninstalled', stillSending: false });
  });

  it('an event after the check began → failed, and the member can try again', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.ingest(lan.ingestToken, userPromptSubmit);
    await s.admin('POST', `/trainings/${t.id}/stop`);
    await start(s, lan.token);
    s.clock.advance(1000);
    expect((await s.ingest(lan.ingestToken, postToolUseBash)).statusCode).toBe(200);
    s.clock.advance(UNINSTALL_CHECK_MIN_MS);

    expect((await finish(s, lan.token)).json<UninstallCheckResult>()).toEqual({ result: 'failed' });
    expect((await s.me(lan.token)).json<MyTraining>().member.uninstallCheck).toBe('failed');
    expect((await s.detail(t.id)).members[0]).toMatchObject({ connection: 'connected', stillSending: true });

    await start(s, lan.token);
    s.clock.advance(UNINSTALL_CHECK_MIN_MS);
    expect((await finish(s, lan.token)).json<UninstallCheckResult>()).toEqual({ result: 'passed' });
    expect((await s.detail(t.id)).members[0]).toMatchObject({ connection: 'uninstalled', stillSending: false });
  });

  it('is refused (409) while the training is open and before a check was started; and needs the member token (401)', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    expect((await start(s, lan.token)).statusCode).toBe(409);
    expect((await finish(s, lan.token)).statusCode).toBe(409);
    await s.admin('POST', `/trainings/${t.id}/stop`);
    expect((await finish(s, lan.token)).statusCode).toBe(409);
    expect((await start(s, 'nope')).statusCode).toBe(401);
    expect((await finish(s, 'nope')).statusCode).toBe(401);
  });
});

describe('mentor signal', () => {
  it('50 events in one burst send the mentor screen one signal, not fifty', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    const seen: number[] = [];
    const off = bus.subscribeTraining(id => seen.push(id));
    try {
      const t0 = Date.now();
      for (let i = 0; i < 50; i++) expect((await s.ingest(lan.ingestToken, userPromptSubmit)).statusCode).toBe(204);
      const windows = Math.ceil((Date.now() - t0) / 2000); // a slow machine may stretch the burst over more than one 2 s window
      expect(seen.every(id => id === t.id)).toBe(true);
      expect(seen.length).toBeGreaterThanOrEqual(1);
      expect(seen.length).toBeLessThanOrEqual(windows); // at most one signal per 2 s window, however many events
    } finally {
      off();
    }
    expect(s.events()).toHaveLength(50);
  });
});
