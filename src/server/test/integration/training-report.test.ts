import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { CreatedTraining, TrainingDetail, TrainingEventsPage } from '../../../shared/api/index.js';
import { FakeClock } from '../../application/testing/fakes.js';
import {
  CWD, FILE_SECRET, postToolUseBash, postToolUseEdit, postToolUseWrite, userPromptSubmit,
} from '../../domain/training/fixtures/hook-payloads.js';
import { trainingEventMarks, trainingEvents, trainingMembers } from '../../infrastructure/db/schema.js';
import { createTestApp, loginAsMentor } from '../helpers.js';

const LAN = '192.168.1.50';

async function setup() {
  const clock = new FakeClock(Date.now());
  const { app, db } = await createTestApp({ ports: { clock } });
  const headers = await loginAsMentor(app);
  const admin = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) => app.inject({ method, url: `/api/admin${url}`, headers, payload });
  const training = async () => (await admin('POST', '/trainings', { name: 'Buổi 1' })).json<CreatedTraining>();
  const detail = async (id: number) => (await admin('GET', `/trainings/${id}`)).json<TrainingDetail>();
  const member = async (t: CreatedTraining, displayName: string) => {
    const res = await app.inject({ method: 'POST', url: `/api/trainings/${t.id}/join`, payload: { displayName, roomCode: t.roomCode, consent: true }, remoteAddress: LAN });
    const token = res.json<{ token: string }>().token;
    const row = db.select().from(trainingMembers).where(eq(trainingMembers.token, token)).get()!;
    return { token, ingestToken: row.ingestToken, id: row.id };
  };
  const ingest = (token: string, payload: unknown) =>
    app.inject({ method: 'POST', url: '/api/training/ingest', headers: { 'x-training-token': token, 'content-type': 'application/json' }, payload: JSON.stringify(payload), remoteAddress: LAN });
  const timeline = async (t: CreatedTraining, memberId: number) => (await admin('GET', `/trainings/${t.id}/members/${memberId}/events`)).json<TrainingEventsPage>().events;
  const report = (t: CreatedTraining, preview = false) => admin('GET', `/trainings/${t.id}/report.md${preview ? '?preview=1' : ''}`);
  return { app, db, admin, training, detail, member, ingest, timeline, report };
}

describe('marking examples (S40)', () => {
  it('marks and unmarks an event, both idempotent; the timeline row says so', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.ingest(lan.ingestToken, userPromptSubmit);
    await s.ingest(lan.ingestToken, postToolUseBash);
    const [prompt, tool] = await s.timeline(t, lan.id);
    expect([prompt!.marked, tool!.marked]).toEqual([false, false]);

    for (let i = 0; i < 2; i++) expect((await s.admin('PUT', `/trainings/${t.id}/events/${prompt!.id}/mark`)).statusCode).toBe(204);
    expect((await s.timeline(t, lan.id)).map(e => e.marked)).toEqual([true, false]);

    for (let i = 0; i < 2; i++) expect((await s.admin('DELETE', `/trainings/${t.id}/events/${prompt!.id}/mark`)).statusCode).toBe(204);
    expect((await s.timeline(t, lan.id)).map(e => e.marked)).toEqual([false, false]);
  });

  it('refuses an event of another training (404), an unknown event (404) and a bad id (404)', async () => {
    const s = await setup();
    const a = await s.training();
    const b = await s.training();
    const lan = await s.member(a, 'Lan');
    await s.ingest(lan.ingestToken, userPromptSubmit);
    const [event] = await s.timeline(a, lan.id);
    expect((await s.admin('PUT', `/trainings/${b.id}/events/${event!.id}/mark`)).statusCode).toBe(404);
    expect((await s.admin('PUT', `/trainings/${a.id}/events/9999/mark`)).statusCode).toBe(404);
    expect((await s.admin('PUT', `/trainings/${a.id}/events/abc/mark`)).statusCode).toBe(404);
    expect((await s.admin('PUT', '/trainings/999/events/1/mark')).statusCode).toBe(404);
  });

  it('needs the mentor', async () => {
    const s = await setup();
    const res = await s.app.inject({ method: 'PUT', url: '/api/admin/trainings/1/events/1/mark' });
    expect(res.statusCode).toBe(401);
  });
});

describe('the mentor note (S40)', () => {
  it('is saved, trimmed, shown on the member row and cleared by an empty note', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    expect((await s.detail(t.id)).members[0]!.mentorNote).toBeNull();
    expect((await s.admin('PUT', `/trainings/${t.id}/members/${lan.id}/note`, { note: '  Nhắc chạy test  ' })).statusCode).toBe(204);
    expect((await s.detail(t.id)).members[0]!.mentorNote).toBe('Nhắc chạy test');
    expect((await s.admin('PUT', `/trainings/${t.id}/members/${lan.id}/note`, { note: '   ' })).statusCode).toBe(204);
    expect((await s.detail(t.id)).members[0]!.mentorNote).toBeNull();
  });

  it('rejects a missing or too long note (400) and a member of another training (404)', async () => {
    const s = await setup();
    const a = await s.training();
    const b = await s.training();
    const lan = await s.member(a, 'Lan');
    expect((await s.admin('PUT', `/trainings/${a.id}/members/${lan.id}/note`, {})).statusCode).toBe(400);
    expect((await s.admin('PUT', `/trainings/${a.id}/members/${lan.id}/note`, { note: 'x'.repeat(2001) })).statusCode).toBe(400);
    expect((await s.admin('PUT', `/trainings/${b.id}/members/${lan.id}/note`, { note: 'ok' })).statusCode).toBe(404);
    expect((await s.admin('PUT', `/trainings/${a.id}/members/9999/note`, { note: 'ok' })).statusCode).toBe(404);
  });
});

describe('the report (S40)', () => {
  it('names the members and carries flags, figures, marked examples and the note', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.member(t, 'Mai');
    await s.ingest(lan.ingestToken, userPromptSubmit);
    await s.ingest(lan.ingestToken, postToolUseBash);
    const [prompt] = await s.timeline(t, lan.id);
    await s.admin('PUT', `/trainings/${t.id}/events/${prompt!.id}/mark`);
    await s.admin('PUT', `/trainings/${t.id}/members/${lan.id}/note`, { note: 'Làm tốt, nhắc thêm về test' });

    const res = await s.report(t);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/markdown; charset=utf-8');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="bao-cao-training-${t.id}.md"`);
    expect(res.body).toContain('# Báo cáo buổi training: Buổi 1');
    expect(res.body).toContain('### Lan\n');
    expect(res.body).toContain('### Mai\n');
    expect(res.body).toContain('1 prompt · 1 lệnh (0 lỗi)');
    expect(res.body).toContain('Viết hàm cộng hai số');
    expect(res.body).toContain('Làm tốt, nhắc thêm về test');
    // Only the marked prompt is an example: the unmarked command is counted, not quoted.
    expect(res.body).not.toContain('npm test');
  });

  it('never carries an output or the content of a file, even for a marked tool row', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    for (const p of [postToolUseBash, postToolUseWrite, postToolUseEdit]) await s.ingest(lan.ingestToken, p);
    for (const e of await s.timeline(t, lan.id)) await s.admin('PUT', `/trainings/${t.id}/events/${e.id}/mark`);

    const res = await s.report(t);
    expect(res.body).toContain('Bash `npm test`');
    expect(res.body).toContain('`src/add.ts`');
    for (const hidden of ['Tests: 3 passed', 'PASS src/add.test.ts', 'export const add', 'a + b + 0', FILE_SECRET, CWD]) expect(res.body).not.toContain(hidden);
  });

  it('masks what looks like a secret in a prompt, a command and the note', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.ingest(lan.ingestToken, { ...userPromptSubmit, prompt: 'dùng khoá sk-live-abcdefghijklmnop1234 nhé' });
    await s.ingest(lan.ingestToken, { ...postToolUseBash, tool_input: { command: 'export DB_PASSWORD=hunter2hunter2 && npm test' } });
    for (const e of await s.timeline(t, lan.id)) await s.admin('PUT', `/trainings/${t.id}/events/${e.id}/mark`);
    await s.admin('PUT', `/trainings/${t.id}/members/${lan.id}/note`, { note: 'đã lộ TOKEN=abcdefgh12345678' });

    const { body } = await s.report(t);
    for (const secret of ['sk-live-abcdefghijklmnop1234', 'hunter2hunter2', 'abcdefgh12345678']) expect(body).not.toContain(secret);
    expect(body).toContain('[đã che]');
  });

  it('keeps a member who stopped sending (marked so) until the mentor purges them', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    const mai = await s.member(t, 'Mai');
    await s.ingest(lan.ingestToken, userPromptSubmit);
    await s.app.inject({ method: 'DELETE', url: '/api/training/me', headers: { 'x-training-member-token': lan.token }, remoteAddress: LAN });

    expect((await s.report(t)).body).toContain('### Lan (đã dừng gửi)');
    expect((await s.report(t)).body).toContain('### Mai\n');

    await s.admin('POST', `/trainings/${t.id}/members/${lan.id}/purge`);
    const after = (await s.report(t)).body;
    expect(after).not.toContain('Lan');
    expect(after).toContain('### Mai\n');
    void mai;
  });

  it('a preview is the same text and does not count as an export; a download does', async () => {
    const s = await setup();
    const t = await s.training();
    await s.member(t, 'Lan');
    expect((await s.detail(t.id)).reportExportedAt).toBeNull();

    const preview = await s.report(t, true);
    expect(preview.headers['content-disposition']).toBeUndefined();
    expect((await s.detail(t.id)).reportExportedAt).toBeNull();

    const download = await s.report(t);
    expect((await s.detail(t.id)).reportExportedAt).not.toBeNull();
    expect(preview.body.replace(/Xuất lúc .*/, '')).toBe(download.body.replace(/Xuất lúc .*/, ''));
  });

  it('is available once stopped, 404 for an unknown training, and 409 once ended', async () => {
    const s = await setup();
    const t = await s.training();
    await s.member(t, 'Lan');
    expect((await s.report(t)).statusCode).toBe(200);
    await s.admin('POST', `/trainings/${t.id}/stop`);
    expect((await s.report(t)).statusCode).toBe(200);
    expect((await s.admin('GET', '/trainings/999/report.md')).statusCode).toBe(404);
    await s.admin('POST', `/trainings/${t.id}/end`);
    expect((await s.report(t)).statusCode).toBe(409);
    expect((await s.report(t, true)).statusCode).toBe(409);
  });

  it('needs the mentor', async () => {
    const s = await setup();
    expect((await s.app.inject({ method: 'GET', url: '/api/admin/trainings/1/report.md' })).statusCode).toBe(401);
  });
});

describe('ending the training (S40)', () => {
  it('deletes the marks and the notes with the members and refuses to mark or note afterwards', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.ingest(lan.ingestToken, userPromptSubmit);
    const [event] = await s.timeline(t, lan.id);
    await s.admin('PUT', `/trainings/${t.id}/events/${event!.id}/mark`);
    await s.admin('PUT', `/trainings/${t.id}/members/${lan.id}/note`, { note: 'ghi chú' });
    expect(s.db.select().from(trainingEventMarks).all()).toHaveLength(1);

    await s.admin('POST', `/trainings/${t.id}/stop`);
    expect((await s.admin('POST', `/trainings/${t.id}/end`)).statusCode).toBe(200);
    expect(s.db.select().from(trainingEventMarks).all()).toEqual([]);
    expect(s.db.select().from(trainingEvents).all()).toEqual([]);
    expect(s.db.select({ note: trainingMembers.mentorNote }).from(trainingMembers).all()).toEqual([]);

    expect((await s.admin('PUT', `/trainings/${t.id}/events/${event!.id}/mark`)).statusCode).toBe(409);
    expect((await s.admin('PUT', `/trainings/${t.id}/members/${lan.id}/note`, { note: 'x' })).statusCode).toBe(409);
  });

  it('removing one member (or purging) takes their marks with them', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.ingest(lan.ingestToken, userPromptSubmit);
    const [event] = await s.timeline(t, lan.id);
    await s.admin('PUT', `/trainings/${t.id}/events/${event!.id}/mark`);
    await s.admin('DELETE', `/trainings/${t.id}/members/${lan.id}`);
    expect(s.db.select().from(trainingEventMarks).all()).toEqual([]);
  });
});
