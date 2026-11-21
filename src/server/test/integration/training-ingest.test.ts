import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { CreatedTraining, MyTraining, TrainingDetail, UninstallCheckResult } from '../../../shared/api/index.js';
import { FakeClock } from '../../application/testing/fakes.js';
import {
  ASSISTANT_ANSWER, CWD, FILE_SECRET, TRANSCRIPT,
  WIN_CWD, postToolUseFailurePowerShell, postToolUsePowerShell,
  postToolUseBash, postToolUseEdit, postToolUseFailure, postToolUseRead, postToolUseWrite, stop, userPromptSubmit,
  SCRATCHPAD, notificationIdle, notificationPermission, permissionRequestBash, permissionRequestEdit, permissionRequestExitPlan,
  postCompact, postModelSwitch, postToolUseAskUserQuestion, postToolUseExitPlan, preCompactAuto, preCompactManual, sessionEndClear, sessionEndExit,
} from '../../domain/training/fixtures/hook-payloads.js';
import { bus } from '../../infrastructure/events/event-bus.js';
import { trainingEvents, trainingMembers } from '../../infrastructure/db/schema.js';
import { UNINSTALL_CHECK_MIN_MS } from '../../domain/training/training.js';
import { STOPPED_REMINDER, STOPPED_SENDING_REMINDER } from '../../interface/http/training-routes.js';
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

describe('ingest: session, permission, question and plan (S37)', () => {
  it('stores each new kind with its subtype, note, permission mode and turn id, and answers 204', async () => {
    const s = await setup();
    const lan = await s.member(await s.training(), 'Lan');
    const payloads = [
      sessionEndClear, preCompactManual, preCompactAuto, postModelSwitch, notificationPermission, notificationIdle,
      permissionRequestEdit, postToolUseAskUserQuestion, postToolUseExitPlan, sessionEndExit,
    ];
    for (const p of payloads) {
      const res = await s.ingest(lan.ingestToken, p);
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
    }
    expect(s.events().map(r => [r.kind, r.subtype ?? r.toolName, r.note])).toEqual([
      ['session', 'clear', null],
      ['session', 'compact_manual', 'giữ lại ý chính'],
      ['session', 'compact_auto', null],
      ['session', 'model_switch', 'claude-opus-4-5 → claude-sonnet-4-5'],
      ['notice', 'waiting_permission', null],
      ['notice', 'idle', null],
      ['permission', 'Edit', null],
      ['tool', 'AskUserQuestion', 'Dùng thư viện nào? → vitest'],
      ['tool', 'ExitPlanMode', null],
      ['session', 'exit', null],
    ]);
    const rows = s.events();
    expect(rows[6]).toMatchObject({ toolTarget: 'src/add.ts', changeHead: '- a + b\n+ a + b + 0', permissionMode: 'default', promptId: 'prompt-1111' });
    expect(rows[8]).toMatchObject({ outputHead: '# Kế hoạch\n1. Viết hàm add\n2. Chạy test', permissionMode: 'plan' });
  });

  it('PostCompact and an unknown Notification store nothing', async () => {
    const s = await setup();
    const lan = await s.member(await s.training(), 'Lan');
    for (const p of [postCompact, { ...notificationIdle, notification_type: 'auth_success' }]) expect((await s.ingest(lan.ingestToken, p)).statusCode).toBe(204);
    expect(s.events()).toEqual([]);
  });

  it('nothing stored contains the exercise folder, the scratchpad or the transcript', async () => {
    const s = await setup();
    const lan = await s.member(await s.training(), 'Lan');
    for (const p of [sessionEndClear, preCompactManual, postModelSwitch, notificationPermission, permissionRequestEdit, permissionRequestBash, permissionRequestExitPlan, postToolUseAskUserQuestion, postToolUseExitPlan]) {
      await s.ingest(lan.ingestToken, p);
    }
    const json = JSON.stringify(s.events());
    for (const forbidden of [CWD, SCRATCHPAD, TRANSCRIPT, '/home/lan']) expect(json, forbidden).not.toContain(forbidden);
  });

  it('the member timeline lists every kind, in order, and the counts include the new ones', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    for (const p of [userPromptSubmit, sessionEndClear, permissionRequestEdit, notificationPermission, postToolUseBash, preCompactAuto]) await s.ingest(lan.ingestToken, p);
    const res = await s.admin('GET', `/trainings/${t.id}/members/${lan.id}/events`);
    expect(res.json<{ events: { kind: string }[] }>().events.map(e => e.kind)).toEqual(['prompt', 'session', 'permission', 'notice', 'tool', 'session']);
    const row = (await s.detail(t.id)).members[0]!;
    expect([row.promptCount, row.toolCount, row.clearCount, row.compactCount, row.permissionCount]).toEqual([1, 1, 1, 1, 1]);
  });
});

describe('S39: flags, inferred decisions and the auto-accept switch', () => {
  const ago = (s: Awaited<ReturnType<typeof setup>>, ms: number) => s.clock.advance(ms);

  it('a permission row gets an inferred decision; denied when the next prompt came without the tool', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.ingest(lan.ingestToken, permissionRequestBash);
    await s.ingest(lan.ingestToken, userPromptSubmit);
    const { events } = (await s.admin('GET', `/trainings/${t.id}/members/${lan.id}/events`)).json<{ events: { kind: string; decision?: string; toolName?: string }[] }>();
    expect(events[0]).toMatchObject({ kind: 'permission', toolName: 'Bash', decision: 'denied' });
  });

  it('flags come with the events behind them; the training detail only counts them, with no names', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    const leak = { ...postToolUseBash, tool_input: { command: 'echo token=abcdefgh12345678' } };
    await s.ingest(lan.ingestToken, userPromptSubmit);
    await s.ingest(lan.ingestToken, leak);
    ago(s, 10);
    const page = (await s.admin('GET', `/trainings/${t.id}/members/${lan.id}/events`)).json<{ events: { id: number }[]; flags: { code: string; eventIds: number[] }[] }>();
    expect(page.flags).toEqual([{ code: 'possible_secret', eventIds: [page.events[1]!.id] }]);
    const d = await s.detail(t.id);
    expect(d.members[0]!.flags).toEqual(['possible_secret']);
    expect(d.flagCounts.possible_secret).toBe(1);
    expect(d.flagCounts.dangerous_command).toBe(0);
    // aggregate: numbers only
    expect(Object.values(d.flagCounts).every(v => typeof v === 'number')).toBe(true);
    expect(JSON.stringify(d.flagCounts)).not.toContain('Lan');
  });

  it('the auto-accept flag goes up, unless the mentor allowed it when creating the training', async () => {
    const s = await setup();
    const bypass = { ...userPromptSubmit, permission_mode: 'bypassPermissions' };
    const strict = await s.training();
    const lan = await s.member(strict, 'Lan');
    await s.ingest(lan.ingestToken, bypass);
    expect((await s.detail(strict.id)).members[0]!.flags).toEqual(['auto_accept']);
    expect((await s.detail(strict.id)).allowAutoAccept).toBe(false);

    const res = await s.admin('POST', '/trainings', { name: 'Cho phép', allowAutoAccept: true });
    const relaxed = res.json<CreatedTraining>();
    const mai = await s.member(relaxed, 'Mai');
    await s.ingest(mai.ingestToken, bypass);
    const d = await s.detail(relaxed.id);
    expect(d.allowAutoAccept).toBe(true);
    expect(d.members[0]!.flags).toEqual([]);
    expect(d.flagCounts.auto_accept).toBe(0);
  });

  it('flags follow new events (not stuck on a cached answer)', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.ingest(lan.ingestToken, userPromptSubmit);
    expect((await s.detail(t.id)).members[0]!.flags).toEqual([]);
    await s.ingest(lan.ingestToken, { ...postToolUseBash, tool_input: { command: 'git push --force' } });
    expect((await s.detail(t.id)).members[0]!.flags).toEqual(['dangerous_command']);
  });
});

describe('ingest: PermissionRequest never gets a decision (S37 safety invariant)', () => {
  /** Whatever the state, the answer to a PermissionRequest is an empty 204: no body, so no `hookSpecificOutput` and no `decision`. */
  const expectSilent = (res: { statusCode: number; body: string; headers: Record<string, unknown> }) => {
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(res.body).not.toMatch(/hookSpecificOutput|decision|behavior|allow/);
  };

  it('open training', async () => {
    const s = await setup();
    const lan = await s.member(await s.training(), 'Lan');
    expectSilent(await s.ingest(lan.ingestToken, permissionRequestBash));
    expectSilent(await s.ingest(lan.ingestToken, permissionRequestExitPlan));
  });

  it('stopped training: no reminder either (a systemMessage is not a decision, but this hook gets nothing)', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.admin('POST', `/trainings/${t.id}/stop`);
    expectSilent(await s.ingest(lan.ingestToken, permissionRequestBash));
    expect((await s.ingest(lan.ingestToken, postToolUseBash)).json()).toEqual({ systemMessage: STOPPED_REMINDER });
    expect(s.events()).toEqual([]);
  });

  it('unknown or missing token, and unparseable body', async () => {
    const s = await setup();
    await s.member(await s.training(), 'Lan');
    expectSilent(await s.ingest('not-a-token', permissionRequestBash));
    expectSilent(await s.ingest(undefined, permissionRequestBash));
    expect((await s.ingest('not-a-token', postToolUseBash)).statusCode).toBe(404);
  });

  it('no ingest answer, for any fixture and any state, carries hookSpecificOutput or decision', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    const all = [
      userPromptSubmit, postToolUseBash, postToolUseFailure, sessionEndClear, preCompactManual, postModelSwitch, notificationPermission,
      permissionRequestEdit, permissionRequestBash, permissionRequestExitPlan, postToolUseAskUserQuestion, postToolUseExitPlan, stop,
    ];
    const check = async (token: string) => {
      for (const p of all) expect((await s.ingest(token, p)).body, JSON.stringify(p).slice(0, 60)).not.toMatch(/hookSpecificOutput|decision/);
    };
    await check(lan.ingestToken);
    await check('not-a-token');
    await s.admin('POST', `/trainings/${t.id}/stop`);
    await check(lan.ingestToken);
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

  it('once ended, or after the mentor purged the member, the token is unknown (404)', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    const mai = await s.member(t, 'Mai');
    await s.app.inject({ method: 'DELETE', url: '/api/training/me', headers: { 'x-training-member-token': mai.token }, remoteAddress: LAN });
    expect((await s.admin('POST', `/trainings/${t.id}/members/${mai.id}/purge`)).statusCode).toBe(204);
    expect((await s.ingest(mai.ingestToken, userPromptSubmit)).statusCode).toBe(404);
    await s.admin('POST', `/trainings/${t.id}/stop`);
    await s.admin('POST', `/trainings/${t.id}/end`);
    expect((await s.ingest(lan.ingestToken, userPromptSubmit)).statusCode).toBe(404);
  });
});

describe('after the member\'s own "Dừng gửi" (S38)', () => {
  const stopSending = (s: Awaited<ReturnType<typeof setup>>, token: string) =>
    s.app.inject({ method: 'DELETE', url: '/api/training/me', headers: { 'x-training-member-token': token }, remoteAddress: LAN });

  it('new events are not stored and get their own reminder; what was stored stays; others keep being stored', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    const mai = await s.member(t, 'Mai');
    await s.ingest(lan.ingestToken, userPromptSubmit);
    expect(s.events()).toHaveLength(1);
    expect((await stopSending(s, lan.token)).statusCode).toBe(204);

    for (const p of [userPromptSubmit, postToolUseBash]) {
      const res = await s.ingest(lan.ingestToken, p);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ systemMessage: STOPPED_SENDING_REMINDER });
    }
    expect(STOPPED_SENDING_REMINDER).toMatch(/dừng gửi/);
    expect(s.events()).toHaveLength(1); // only the one from before
    expect((await s.ingest(mai.ingestToken, userPromptSubmit)).statusCode).toBe(204);
    expect(s.events()).toHaveLength(2);
  });

  it('a hook that is not ours still gets 204, and a PermissionRequest gets an empty 204 (safety invariant)', async () => {
    const s = await setup();
    const lan = await s.member(await s.training(), 'Lan');
    await stopSending(s, lan.token);
    expect((await s.ingest(lan.ingestToken, stop)).statusCode).toBe(204);
    const res = await s.ingest(lan.ingestToken, permissionRequestBash);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(s.events()).toEqual([]);
  });

  it('the mentor sees the member still sending after stopping (stillSending), with the name and stopped_sending', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await stopSending(s, lan.token);
    expect((await s.detail(t.id)).members[0]).toMatchObject({ displayName: 'Lan', connection: 'stopped_sending', stoppedSending: true, stillSending: false });
    await s.ingest(lan.ingestToken, userPromptSubmit);
    expect((await s.detail(t.id)).members[0]).toMatchObject({ connection: 'stopped_sending', stoppedSending: true, stillSending: true });
  });

  it('after "Dừng thu" a member who stopped sending still takes the removal check', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await stopSending(s, lan.token);
    await s.admin('POST', `/trainings/${t.id}/stop`);
    expect((await s.me(lan.token, '/uninstall-check', 'POST')).statusCode).toBe(204);
    s.clock.advance(UNINSTALL_CHECK_MIN_MS + 1);
    expect((await s.me(lan.token, '/uninstall-check/finish', 'POST')).json<UninstallCheckResult>()).toEqual({ result: 'passed' });
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
      const windows = Math.ceil((Date.now() - t0) / 2000) + 1; // the first signal goes out at once, then one per 2 s window; a slow machine may stretch the burst over more than one window
      expect(seen.every(id => id === t.id)).toBe(true);
      expect(seen.length).toBeGreaterThanOrEqual(1);
      expect(seen.length).toBeLessThanOrEqual(windows); // one at once plus at most one per 2 s window, however many events
    } finally {
      off();
    }
    expect(s.events()).toHaveLength(50);
  });
});
