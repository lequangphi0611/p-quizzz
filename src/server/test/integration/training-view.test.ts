import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { CreatedTraining, TrainingDetail, TrainingEventDetail, TrainingEventsPage } from '../../../shared/api/index.js';
import { FakeClock } from '../../application/testing/fakes.js';
import { postToolUseFailurePowerShell, postToolUsePowerShell, postToolUseBash, postToolUseEdit, postToolUseFailure, postToolUseRead, postToolUseWrite, userPromptSubmit } from '../../domain/training/fixtures/hook-payloads.js';
import { UNINSTALL_CHECK_MIN_MS } from '../../domain/training/training.js';
import { trainingEvents, trainingMembers } from '../../infrastructure/db/schema.js';
import { LOCAL_ONLY_MESSAGE } from '../../interface/http/auth/require-local.js';
import { createTestApp, loginAsMentor } from '../helpers.js';
import { allKeys } from '../world.js';

const LAN = '192.168.1.50';

async function setup() {
  const clock = new FakeClock(Date.now());
  const { app, db } = await createTestApp({ ports: { clock } });
  const headers = await loginAsMentor(app);
  const admin = (method: 'GET' | 'POST', url: string, payload?: object) => app.inject({ method, url: `/api/admin${url}`, headers, payload });
  const training = async (name = 'Buổi 1') => (await admin('POST', '/trainings', { name })).json<CreatedTraining>();
  const detail = async (id: number) => (await admin('GET', `/trainings/${id}`)).json<TrainingDetail>();
  const member = async (t: CreatedTraining, displayName: string) => {
    const res = await app.inject({ method: 'POST', url: `/api/trainings/${t.id}/join`, payload: { displayName, roomCode: t.roomCode, consent: true }, remoteAddress: LAN });
    const token = res.json<{ token: string }>().token;
    const row = db.select().from(trainingMembers).where(eq(trainingMembers.token, token)).get()!;
    return { token, ingestToken: row.ingestToken, id: row.id };
  };
  const send = async (ingestToken: string, ...payloads: unknown[]) => {
    for (const p of payloads) {
      const res = await app.inject({ method: 'POST', url: '/api/training/ingest', headers: { 'x-training-token': ingestToken, 'content-type': 'application/json' }, payload: JSON.stringify(p), remoteAddress: LAN });
      expect([200, 204]).toContain(res.statusCode);
    }
  };
  const timeline = (trainingId: number, memberId: number, after?: number) =>
    admin('GET', `/trainings/${trainingId}/members/${memberId}/events${after === undefined ? '' : `?after=${after}`}`);
  const eventDetail = (trainingId: number, eventId: number) => admin('GET', `/trainings/${trainingId}/events/${eventId}/detail`);
  return { app, db, clock, headers, admin, training, detail, member, send, timeline, eventDetail };
}

const bashFail = (command = 'npm test') => ({ ...postToolUseFailure, tool_input: { command } });

describe('training detail: counts, stuck, still sending', () => {
  it('counts what was received and flags a member who failed the same command three times', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    const mai = await s.member(t, 'Mai');
    await s.send(lan.ingestToken, userPromptSubmit, postToolUseBash, bashFail(), bashFail(), bashFail(), userPromptSubmit);
    await s.send(mai.ingestToken, bashFail('a'), bashFail('b'), bashFail('c'));

    const d = await s.detail(t.id);
    expect(d.members.find(m => m.displayName === 'Lan')).toMatchObject({ promptCount: 2, toolCount: 4, failedCount: 3, stuck: true, connection: 'connected' });
    expect(d.members.find(m => m.displayName === 'Mai')).toMatchObject({ promptCount: 0, toolCount: 3, failedCount: 3, stuck: false });

    await s.send(lan.ingestToken, postToolUseBash); // one success clears the flag
    expect((await s.detail(t.id)).members.find(m => m.displayName === 'Lan')!.stuck).toBe(false);
  });

  it('members come in a fixed order (by join), not by how many errors they have', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    const mai = await s.member(t, 'Mai');
    await s.send(mai.ingestToken, bashFail(), bashFail());
    expect((await s.detail(t.id)).members.map(m => m.displayName)).toEqual(['Lan', 'Mai']);
    expect(lan.id).toBeLessThan(mai.id);
  });

  it('after the stop: stillSending for who keeps sending, uninstalled counts who passed the check; once ended there are no members', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    const mai = await s.member(t, 'Mai');
    await s.send(lan.ingestToken, userPromptSubmit);
    await s.send(mai.ingestToken, userPromptSubmit);
    await s.admin('POST', `/trainings/${t.id}/stop`);
    await s.send(mai.ingestToken, postToolUseBash); // Mai's hook is still there

    await s.app.inject({ method: 'POST', url: '/api/training/me/uninstall-check', headers: { 'x-training-member-token': lan.token }, remoteAddress: LAN });
    s.clock.advance(UNINSTALL_CHECK_MIN_MS);
    await s.app.inject({ method: 'POST', url: '/api/training/me/uninstall-check/finish', headers: { 'x-training-member-token': lan.token }, remoteAddress: LAN });

    const d = await s.detail(t.id);
    expect(d.uninstalled).toEqual({ count: 1, total: 2 });
    expect(d.members.find(m => m.displayName === 'Lan')).toMatchObject({ connection: 'uninstalled', stillSending: false });
    expect(d.members.find(m => m.displayName === 'Mai')).toMatchObject({ connection: 'connected', stillSending: true });

    const ended = (await s.admin('POST', `/trainings/${t.id}/end`)).json<TrainingDetail>();
    expect(ended).toMatchObject({ status: 'ended', members: [], uninstalled: null });
  });
});

describe('PowerShell on the timeline and the stuck flag', () => {
  it('shows the command with a clean summary, and flags three failures of the same PowerShell command', async () => {
    const s = await setup();
    const t = await s.training();
    const win = await s.member(t, 'Lan');
    await s.send(win.ingestToken, postToolUsePowerShell, postToolUseFailurePowerShell, postToolUseFailurePowerShell, postToolUseFailurePowerShell);
    const events = (await s.timeline(t.id, win.id)).json<TrainingEventsPage>().events;
    expect(events[0]).toMatchObject({ toolName: 'PowerShell', toolTarget: 'Get-ChildItem src', summary: '-a--- 52 add.ts', ok: true });
    expect(events[1]).toMatchObject({ ok: false, toolTarget: 'npm test', summary: "npm : The term 'npm' is not recognized\nAt line:1 char:1" });
    expect(JSON.stringify(events)).not.toContain('\\r');
    expect((await s.detail(t.id)).members[0]).toMatchObject({ toolCount: 4, failedCount: 3, stuck: true });
  });
});

describe('member timeline', () => {
  it('lists events in the order received with summaries, flags for output and change, and no output or change at all', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.send(lan.ingestToken, userPromptSubmit, postToolUseBash, postToolUseFailure, postToolUseWrite, postToolUseEdit, postToolUseRead);

    const res = await s.timeline(t.id, lan.id);
    expect(res.statusCode).toBe(200);
    const page = res.json<TrainingEventsPage>();
    expect(page.hasMore).toBe(false);
    expect(page.events.map(e => [e.kind, e.toolName, e.toolTarget, e.ok, e.summary, e.hasOutput, e.hasChange])).toEqual([
      ['prompt', undefined, undefined, undefined, undefined, false, false],
      ['tool', 'Bash', 'npm test', true, 'Tests: 3 passed', true, false],
      ['tool', 'Bash', 'ls /nope', false, 'Exit code 2\nls: cannot access /nope: No such file or directory', false, false],
      ['tool', 'Write', 'src/add.ts', true, undefined, false, true],
      ['tool', 'Edit', 'src/add.ts', true, undefined, false, true],
      ['tool', 'Read', '.env · 2 dòng', true, undefined, false, false],
    ]);
    expect(page.events[0]).toMatchObject({ prompt: 'Viết hàm cộng hai số' });
    expect(page.events[1]).toMatchObject({ durationMs: 2310 });
    const keys = allKeys(page);
    for (const forbidden of ['output', 'change', 'outputHead', 'outputTail', 'changeHead', 'changeTail', 'outputEnd', 'errorExcerpt', 'memberId']) expect(keys.has(forbidden), forbidden).toBe(false);
    const ids = page.events.map(e => e.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it('pages with `after`: 500 rows, hasMore, then the rest', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    s.db.insert(trainingEvents).values(Array.from({ length: 505 }, (_, i) => ({ memberId: lan.id, kind: 'prompt' as const, claudeSessionId: 's', receivedAt: new Date(1000 + i), prompt: `p${i}` }))).run();
    const first = (await s.timeline(t.id, lan.id)).json<TrainingEventsPage>();
    expect(first.events).toHaveLength(500);
    expect(first.hasMore).toBe(true);
    expect(first.events[0]!.prompt).toBe('p0');
    const second = (await s.timeline(t.id, lan.id, first.events.at(-1)!.id)).json<TrainingEventsPage>();
    expect(second.events.map(e => e.prompt)).toEqual(['p500', 'p501', 'p502', 'p503', 'p504']);
    expect(second.hasMore).toBe(false);
  });

  it('a huge output costs the list nothing: only its last line travels', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    const stdout = `${Array.from({ length: 12_500 }, (_, i) => `${i}`.padEnd(80, 'x')).join('\n')}\nXong: 12500 dòng`;
    await s.send(lan.ingestToken, { ...postToolUseBash, tool_response: { stdout } });
    const res = await s.timeline(t.id, lan.id);
    expect(res.body.length).toBeLessThan(1500);
    expect(res.json<TrainingEventsPage>().events[0]).toMatchObject({ summary: 'Xong: 12500 dòng', hasOutput: true });
  });

  it('validates the ids and `after` (400 for a bad `after`, 404 for unknown training or member), and refuses another training\'s member', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    const other = await s.training('Khác');
    for (const after of ['abc', '-1', '1.5']) expect((await s.admin('GET', `/trainings/${t.id}/members/${lan.id}/events?after=${after}`)).statusCode, after).toBe(400);
    expect((await s.timeline(999, lan.id)).statusCode).toBe(404);
    expect((await s.timeline(t.id, 999)).statusCode).toBe(404);
    expect((await s.timeline(other.id, lan.id)).statusCode).toBe(404);
    expect((await s.admin('GET', `/trainings/abc/members/${lan.id}/events`)).statusCode).toBe(404);
    expect((await s.admin('GET', `/trainings/${t.id}/members/abc/events`)).statusCode).toBe(404);
  });

  it('is 409 once the training has ended', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.send(lan.ingestToken, userPromptSubmit);
    await s.admin('POST', `/trainings/${t.id}/stop`);
    expect((await s.timeline(t.id, lan.id)).statusCode).toBe(200); // reviewing is still possible once stopped
    await s.admin('POST', `/trainings/${t.id}/end`);
    expect((await s.timeline(t.id, lan.id)).statusCode).toBe(409);
  });
});

describe('event detail', () => {
  it('returns the clip of the output and of the change, only when asked', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    const stdout = Array.from({ length: 1000 }, (_, i) => `dòng ${i + 1}`).join('\n');
    await s.send(lan.ingestToken, { ...postToolUseBash, tool_response: { stdout } }, postToolUseEdit, userPromptSubmit);
    const [bash, edit, prompt] = (await s.timeline(t.id, lan.id)).json<TrainingEventsPage>().events;

    const out = (await s.eventDetail(t.id, bash!.id)).json<TrainingEventDetail>();
    expect(out.change).toBeNull();
    expect(out.output).toMatchObject({ omittedLines: 600 });
    expect(out.output!.head.split('\n')).toHaveLength(200);
    expect(out.output!.tail!.endsWith('dòng 1000')).toBe(true);

    expect((await s.eventDetail(t.id, edit!.id)).json<TrainingEventDetail>()).toEqual({ output: null, change: { head: '- a + b\n+ a + b + 0', tail: null, omittedLines: 0 } });
    expect((await s.eventDetail(t.id, prompt!.id)).json<TrainingEventDetail>()).toEqual({ output: null, change: null });
  });

  it('404 for an unknown event or one of another training, 409 once ended', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    const other = await s.training('Khác');
    await s.send(lan.ingestToken, postToolUseBash);
    const eventId = (await s.timeline(t.id, lan.id)).json<TrainingEventsPage>().events[0]!.id;

    expect((await s.eventDetail(t.id, 999)).statusCode).toBe(404);
    expect((await s.eventDetail(other.id, eventId)).statusCode).toBe(404);
    expect((await s.eventDetail(999, eventId)).statusCode).toBe(404);
    expect((await s.admin('GET', `/trainings/${t.id}/events/abc/detail`)).statusCode).toBe(404);
    await s.admin('POST', `/trainings/${t.id}/stop`);
    await s.admin('POST', `/trainings/${t.id}/end`);
    expect((await s.eventDetail(t.id, eventId)).statusCode).toBe(409);
  });
});

describe('who can look', () => {
  it('only the mentor machine: another LAN machine gets 403 on both routes, and never sees what was collected', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.send(lan.ingestToken, postToolUseBash);
    for (const url of [`/api/admin/trainings/${t.id}/members/${lan.id}/events`, `/api/admin/trainings/${t.id}/events/1/detail`]) {
      const res = await s.app.inject({ method: 'GET', url, headers: s.headers, remoteAddress: LAN });
      expect(res.statusCode, url).toBe(403);
      expect(res.json()).toEqual({ error: LOCAL_ONLY_MESSAGE });
    }
    // The same paths outside /api/admin do not exist for members.
    for (const url of [`/api/trainings/${t.id}/members/${lan.id}/events`, `/api/trainings/${t.id}/events/1/detail`]) {
      expect((await s.app.inject({ method: 'GET', url, remoteAddress: LAN })).statusCode, url).toBe(404);
    }
  });
});
