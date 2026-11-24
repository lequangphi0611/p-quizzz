import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { CreatedTraining, TrainingDetail, TrainingExportSummary } from '../../../shared/api/index.js';
import { FakeClock } from '../../application/testing/fakes.js';
import { FILE_SECRET, postToolUseBash, postToolUseEdit, postToolUseRead, postToolUseWrite, userPromptSubmit } from '../../domain/training/fixtures/hook-payloads.js';
import { trainingMembers } from '../../infrastructure/db/schema.js';
import { readZip } from '../../infrastructure/system/zip-test-reader.js';
import { createTestApp, loginAsMentor } from '../helpers.js';

const LAN = '192.168.1.50';
const day = (d: number, h = 10, m = 0) => new Date(2026, 10, d, h, m); // local time, like the server's calendar

async function setup() {
  const clock = new FakeClock(day(24));
  const { app, db } = await createTestApp({ ports: { clock } });
  const headers = await loginAsMentor(app);
  const admin = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) => app.inject({ method, url: `/api/admin${url}`, headers, payload });
  const training = async () => (await admin('POST', '/trainings', { name: 'Buổi 1' })).json<CreatedTraining>();
  const member = async (t: CreatedTraining, displayName: string) => {
    const res = await app.inject({ method: 'POST', url: `/api/trainings/${t.id}/join`, payload: { displayName, roomCode: t.roomCode, consent: true }, remoteAddress: LAN });
    const token = res.json<{ token: string }>().token;
    const row = db.select().from(trainingMembers).where(eq(trainingMembers.token, token)).get()!;
    return { token, ingestToken: row.ingestToken, id: row.id };
  };
  const ingest = (token: string, payload: unknown, when?: Date) => {
    if (when) clock.set(when);
    return app.inject({ method: 'POST', url: '/api/training/ingest', headers: { 'x-training-token': token, 'content-type': 'application/json' }, payload: JSON.stringify(payload), remoteAddress: LAN });
  };
  const exportZip = (t: CreatedTraining, query = '') => app.inject({ method: 'GET', url: `/api/admin/trainings/${t.id}/export.zip${query}`, headers });
  const summary = (t: CreatedTraining, query = '') => admin('GET', `/trainings/${t.id}/export/summary${query}`);
  const files = async (t: CreatedTraining, query = '') => {
    const res = await exportZip(t, query);
    expect(res.statusCode).toBe(200);
    return readZip(res.rawPayload);
  };
  const detail = async (id: number) => (await admin('GET', `/trainings/${id}`)).json<TrainingDetail>();
  return { app, clock, headers, admin, training, member, ingest, exportZip, summary, files, detail };
}

describe('exporting the raw data (S41)', () => {
  it('is a zip with an overview and one file per member, named without accents, with the raw output and file changes', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.member(t, 'Nguyễn Văn An');
    await s.member(t, 'Mai');
    for (const p of [userPromptSubmit, postToolUseBash, postToolUseWrite, postToolUseEdit, postToolUseRead]) await s.ingest(an.ingestToken, p);

    const res = await s.exportZip(t);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="du-lieu-training-${t.id}-2026-11-24.zip"`);
    expect(res.headers['cache-control']).toBe('no-store');

    const files = readZip(res.rawPayload);
    expect([...files.keys()].sort()).toEqual(['00-tong-quan.md', '01-nguyen-van-an.md', '02-mai.md']);
    const text = files.get('01-nguyen-van-an.md')!;
    expect(text).toMatch(/^# Nguyễn Văn An\n/);
    expect(text).toContain('Viết hàm cộng hai số');
    expect(text).toContain('**Bash** `npm test`');
    expect(text).toContain('PASS src/add.test.ts'); // raw output: the report leaves it out, this file keeps it
    expect(text).toContain('Tests: 3 passed');
    expect(text).toContain('export const add'); // what Write put in the file
    expect(files.get('02-mai.md')).toContain('Không có sự kiện nào trong khoảng này.');
    expect(files.get('00-tong-quan.md')).toContain('2 bạn · 5 sự kiện');
  });

  it('never carries what the hooks do not collect: the content of a Read, absolute paths', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.member(t, 'An');
    for (const p of [userPromptSubmit, postToolUseRead, postToolUseBash]) await s.ingest(an.ingestToken, p);
    const all = [...(await s.files(t)).values()].join('\n');
    expect(all).toContain('**Read**');
    expect(all).not.toContain(FILE_SECRET);
    expect(all).not.toContain('/home/lan');
  });

  it('masks what looks like a key or a password, in the prompt, a command and an output', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.member(t, 'An');
    await s.ingest(an.ingestToken, { ...userPromptSubmit, prompt: 'dùng khoá sk-live-abcdefghijklmnop1234 nhé' });
    await s.ingest(an.ingestToken, { ...postToolUseBash, tool_input: { command: 'cat .env' }, tool_response: { stdout: 'DB_PASSWORD=hunter2hunter2\nok', stderr: '', interrupted: false } });
    await s.admin('PUT', `/trainings/${t.id}/members/${an.id}/note`, { note: 'đã lộ TOKEN=abcdefgh12345678' });
    const all = [...(await s.files(t)).values()].join('\n');
    for (const secret of ['sk-live-abcdefghijklmnop1234', 'hunter2hunter2', 'abcdefgh12345678']) expect(all).not.toContain(secret);
    expect(all).toContain('[đã che]');
  });

  it('is today by default, one day with `from`, and every day from `from` to `to`', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.member(t, 'An');
    await s.ingest(an.ingestToken, { ...userPromptSubmit, prompt: 'ngày 22' }, day(22, 23, 59));
    await s.ingest(an.ingestToken, { ...userPromptSubmit, prompt: 'ngày 23 sáng' }, day(23, 0, 0));
    await s.ingest(an.ingestToken, { ...userPromptSubmit, prompt: 'ngày 23 tối' }, day(23, 23, 59));
    await s.ingest(an.ingestToken, { ...userPromptSubmit, prompt: 'ngày 24' }, day(24, 0, 1));
    s.clock.set(day(24, 18));

    const only = async (query: string) => (await s.files(t, query)).get('01-an.md')!;
    const today = await only('');
    expect(today).toContain('ngày 24');
    expect(today).not.toContain('ngày 23');

    const d23 = await only('?from=2026-11-23');
    expect(d23).toContain('ngày 23 sáng');
    expect(d23).toContain('ngày 23 tối'); // 00:00 and 23:59 both belong to the day
    expect(d23).not.toContain('ngày 22');
    expect(d23).not.toContain('ngày 24');

    const span = await only('?from=2026-11-22&to=2026-11-24');
    for (const p of ['ngày 22', 'ngày 23 sáng', 'ngày 23 tối', 'ngày 24']) expect(span).toContain(p);
    expect(span).toContain('Khoảng thời gian: 22/11/2026 – 24/11/2026');
    expect(span.indexOf('### 22/11/2026')).toBeLessThan(span.indexOf('### 23/11/2026'));
  });

  it('only the chosen members; an unknown member is 404 and a bad list 400', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.member(t, 'An');
    const mai = await s.member(t, 'Mai');
    await s.ingest(an.ingestToken, { ...userPromptSubmit, prompt: 'bài của An' });
    await s.ingest(mai.ingestToken, { ...userPromptSubmit, prompt: 'bài của Mai' });

    const files = await s.files(t, `?members=${mai.id}`);
    expect([...files.keys()].sort()).toEqual(['00-tong-quan.md', '01-mai.md']);
    expect([...files.values()].join('\n')).not.toContain('bài của An');
    expect([...(await s.files(t, `?members=${an.id},${mai.id}`)).keys()]).toHaveLength(3);

    const other = await s.training();
    const stranger = await s.member(other, 'Lạ');
    expect((await s.exportZip(t, `?members=${stranger.id}`)).statusCode).toBe(404);
    expect((await s.exportZip(t, '?members=9999')).statusCode).toBe(404);
    for (const bad of ['?members=', '?members=a,b', '?members=1,,2', '?members=-1']) expect((await s.exportZip(t, bad)).statusCode).toBe(400);
  });

  it('keeps a member who stopped sending (marked so) until the mentor purges them', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.member(t, 'An');
    const mai = await s.member(t, 'Mai');
    await s.ingest(an.ingestToken, userPromptSubmit);
    await s.ingest(mai.ingestToken, userPromptSubmit);
    await s.app.inject({ method: 'DELETE', url: '/api/training/me', headers: { 'x-training-member-token': an.token }, remoteAddress: LAN });

    const before = await s.files(t);
    expect(before.get('01-an.md')).toMatch(/^# An \(đã dừng gửi\)\n/);
    expect(before.get('00-tong-quan.md')).toContain('| 01-an.md | An | 1 | đã dừng gửi |');

    await s.admin('POST', `/trainings/${t.id}/members/${an.id}/purge`);
    const after = await s.files(t);
    expect([...after.keys()].sort()).toEqual(['00-tong-quan.md', '01-mai.md']);
    expect([...after.values()].join('\n')).not.toContain('An');
  });

  it('carries the examples the mentor marked and the mentor note', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.member(t, 'An');
    await s.ingest(an.ingestToken, userPromptSubmit);
    const events = (await s.admin('GET', `/trainings/${t.id}/members/${an.id}/events`)).json<{ events: { id: number }[] }>().events;
    await s.admin('PUT', `/trainings/${t.id}/events/${events[0]!.id}/mark`);
    await s.admin('PUT', `/trainings/${t.id}/members/${an.id}/note`, { note: 'Giao việc rõ' });
    const text = (await s.files(t)).get('01-an.md')!;
    expect(text).toContain('★ ví dụ đã đánh dấu');
    expect(text).toContain('> Giao việc rõ');
  });

  it('is not the report: it does not record an export, and the report still reminds', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.member(t, 'An');
    await s.ingest(an.ingestToken, userPromptSubmit);
    await s.files(t);
    expect((await s.detail(t.id)).reportExportedAt).toBeNull();
  });

  it('works once the training stopped, and is 409 once it ended', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.member(t, 'An');
    await s.ingest(an.ingestToken, userPromptSubmit);
    await s.admin('POST', `/trainings/${t.id}/stop`);
    expect((await s.exportZip(t)).statusCode).toBe(200);
    expect((await s.summary(t)).statusCode).toBe(200);
    await s.admin('POST', `/trainings/${t.id}/end`);
    expect((await s.exportZip(t)).statusCode).toBe(409);
    expect((await s.summary(t)).statusCode).toBe(409);
  });

  it('says there is nothing to download when the days hold no event: 404, not an empty file', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.member(t, 'An');
    await s.ingest(an.ingestToken, userPromptSubmit);
    const res = await s.exportZip(t, '?from=2026-11-01');
    expect(res.statusCode).toBe(404);
    expect(res.json<{ error: string }>().error).toBe('Không có dữ liệu trong khoảng này');
    expect((await s.exportZip(await s.training())).statusCode).toBe(404); // no member at all
  });

  it('refuses a bad day or an upside-down range (400), an unknown training (404) and a visitor without the mentor password (401)', async () => {
    const s = await setup();
    const t = await s.training();
    for (const bad of ['?from=24/11/2026', '?from=2026-02-30', '?from=2026-13-01', '?to=2026-11-24', '?from=2026-11-24&to=2026-11-23', '?from=abc']) {
      expect((await s.exportZip(t, bad)).statusCode, bad).toBe(400);
      expect((await s.summary(t, bad)).statusCode, bad).toBe(400);
    }
    expect((await s.admin('GET', '/trainings/999/export.zip')).statusCode).toBe(404);
    expect((await s.admin('GET', '/trainings/abc/export.zip')).statusCode).toBe(404);
    expect((await s.app.inject({ method: 'GET', url: `/api/admin/trainings/${t.id}/export.zip` })).statusCode).toBe(401);
    expect((await s.app.inject({ method: 'GET', url: `/api/admin/trainings/${t.id}/export/summary` })).statusCode).toBe(401);
  });

  it('is not reachable from a member machine on the LAN, even with the mentor cookie, nor with a member token alone', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.member(t, 'An');
    await s.ingest(an.ingestToken, userPromptSubmit);
    const url = `/api/admin/trainings/${t.id}/export.zip`;
    const fromLan = await s.app.inject({ method: 'GET', url, headers: s.headers, remoteAddress: LAN });
    expect(fromLan.statusCode).toBe(403);
    expect(fromLan.headers['content-type']).not.toBe('application/zip');
    const memberToken = await s.app.inject({ method: 'GET', url, headers: { 'x-training-member-token': an.token } });
    expect(memberToken.statusCode).toBe(401);
  });
});

describe('the export summary (S41)', () => {
  it('counts the members and the events of the days chosen, and gives a size to show before the download', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.member(t, 'An');
    const mai = await s.member(t, 'Mai');
    await s.member(t, 'Nam');
    for (const p of [userPromptSubmit, postToolUseBash]) await s.ingest(an.ingestToken, p);
    await s.ingest(mai.ingestToken, userPromptSubmit, day(23, 9));
    s.clock.set(day(24, 12));

    const get = async (query: string) => (await s.summary(t, query)).json<TrainingExportSummary>();
    const today = await get('');
    expect(today).toMatchObject({ from: '2026-11-24', to: '2026-11-24', memberCount: 3, eventCount: 2, tooLarge: false });
    expect(today.approxBytes).toBeGreaterThan(400);
    expect(await get('?from=2026-11-23')).toMatchObject({ memberCount: 3, eventCount: 1 });
    expect(await get(`?from=2026-11-23&to=2026-11-24`)).toMatchObject({ eventCount: 3 });
    expect(await get(`?members=${mai.id}&from=2026-11-23`)).toMatchObject({ memberCount: 1, eventCount: 1 });
    expect(await get('?from=2026-11-01')).toMatchObject({ eventCount: 0, approxBytes: 0 });
  });
});
