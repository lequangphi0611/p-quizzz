import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { CreatedTraining, TeachingExampleRow, TeachingExamplesResponse, TrainingDetail, TrainingEventRow, TrainingEventsPage } from '../../../shared/api/index.js';
import { FakeClock } from '../../application/testing/fakes.js';
import { CWD, SESSION_ID, postToolUseBash, postToolUseEdit, userPromptSubmit } from '../../domain/training/fixtures/hook-payloads.js';
import { trainingMembers } from '../../infrastructure/db/schema.js';
import { readZip } from '../../infrastructure/system/zip-test-reader.js';
import { createTestApp, loginAsMentor } from '../helpers.js';

const LAN = '192.168.1.50';
const BODY = { label: 'needs_work', topic: 'verify', comment: 'Chưa nói cách kiểm tra kết quả' };

async function setup() {
  const clock = new FakeClock(new Date(2026, 10, 24, 10, 0).getTime());
  const { app, db } = await createTestApp({ ports: { clock } });
  const headers = await loginAsMentor(app);
  const admin = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) => app.inject({ method, url: `/api/admin${url}`, headers, payload });
  const training = async () => (await admin('POST', '/trainings', { name: 'Buổi 1' })).json<CreatedTraining>();
  const member = async (t: CreatedTraining, displayName: string, teachingConsent?: boolean) => {
    const res = await app.inject({
      method: 'POST', url: `/api/trainings/${t.id}/join`, remoteAddress: LAN,
      payload: { displayName, roomCode: t.roomCode, consent: true, ...(teachingConsent === undefined ? {} : { teachingConsent }) },
    });
    expect(res.statusCode).toBe(201);
    const token = res.json<{ token: string }>().token;
    const row = db.select().from(trainingMembers).where(eq(trainingMembers.token, token)).get()!;
    return { token, ingestToken: row.ingestToken, id: row.id, row };
  };
  const ingest = (token: string, payload: unknown) =>
    app.inject({ method: 'POST', url: '/api/training/ingest', headers: { 'x-training-token': token, 'content-type': 'application/json' }, payload: JSON.stringify(payload), remoteAddress: LAN });
  const timeline = async (t: CreatedTraining, memberId: number): Promise<TrainingEventRow[]> => (await admin('GET', `/trainings/${t.id}/members/${memberId}/events`)).json<TrainingEventsPage>().events;
  const detail = async (id: number) => (await admin('GET', `/trainings/${id}`)).json<TrainingDetail>();
  const put = (t: CreatedTraining, eventId: number, body: object = BODY) => admin('PUT', `/trainings/${t.id}/events/${eventId}/teaching-example`, body);
  const list = async (t: CreatedTraining) => (await admin('GET', `/trainings/${t.id}/teaching-examples`)).json<TeachingExamplesResponse>().examples;
  const file = (t: CreatedTraining, query = '?confirmed=1') => admin('GET', `/trainings/${t.id}/teaching-examples.md${query}`);
  /** A member who agreed, with one prompt followed by a command. */
  const agreed = async (t: CreatedTraining, name = 'Nguyễn Văn An') => {
    const m = await member(t, name, true);
    await ingest(m.ingestToken, userPromptSubmit);
    await ingest(m.ingestToken, postToolUseBash);
    const [prompt, toolRow] = await timeline(t, m.id);
    return { ...m, prompt: prompt!, tool: toolRow! };
  };
  return { app, db, clock, headers, admin, training, member, ingest, timeline, detail, put, list, file, agreed };
}

describe('the teaching consent at joining (S44)', () => {
  it('is false when the member does not send it or sends false, true only when ticked; the member can join either way', async () => {
    const s = await setup();
    const t = await s.training();
    const none = await s.member(t, 'Không gửi');
    const no = await s.member(t, 'Không tick', false);
    const yes = await s.member(t, 'Có tick', true);
    expect([none.row.teachingConsent, no.row.teachingConsent, yes.row.teachingConsent]).toEqual([false, false, true]);
    expect((await s.detail(t.id)).members.map(m => m.teachingConsent)).toEqual([false, false, true]);
  });

  it('rejects a teachingConsent that is not a boolean', async () => {
    const s = await setup();
    const t = await s.training();
    const res = await s.app.inject({ method: 'POST', url: `/api/trainings/${t.id}/join`, remoteAddress: LAN, payload: { displayName: 'An', roomCode: t.roomCode, consent: true, teachingConsent: 'yes' } });
    expect(res.statusCode).toBe(400);
  });
});

describe('making an example (S44)', () => {
  it('creates, shows in the timeline row and the member list, replaces, and deletes (idempotent)', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    expect(an.prompt.teachingExample).toBeNull();

    const created = await s.put(t, an.prompt.id);
    expect(created.statusCode).toBe(200);
    expect(created.json<TeachingExampleRow>()).toMatchObject({ eventId: an.prompt.id, label: 'needs_work', topic: 'verify', comment: BODY.comment, betterPrompt: null, editedPrompt: null });
    expect((await s.timeline(t, an.id))[0]!.teachingExample).toEqual({ label: 'needs_work' });
    expect((await s.timeline(t, an.id))[1]!.teachingExample).toBeNull();

    const changed = await s.put(t, an.prompt.id, { ...BODY, label: 'good', betterPrompt: 'bản tốt hơn', editedPrompt: 'prompt đã sửa' });
    expect(changed.json<TeachingExampleRow>()).toMatchObject({ label: 'good', betterPrompt: 'bản tốt hơn', editedPrompt: 'prompt đã sửa' });
    expect(await s.list(t)).toHaveLength(1);

    for (let i = 0; i < 2; i++) expect((await s.admin('DELETE', `/trainings/${t.id}/events/${an.prompt.id}/teaching-example`)).statusCode).toBe(204);
    expect((await s.timeline(t, an.id))[0]!.teachingExample).toBeNull();
    expect(await s.list(t)).toEqual([]);
  });

  it('defaults the topic to other and treats null / missing optional texts as cleared', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    await s.put(t, an.prompt.id, { label: 'good', comment: 'ok', editedPrompt: 'x', betterPrompt: 'y' });
    const again = await s.put(t, an.prompt.id, { label: 'good', comment: 'ok', editedPrompt: null });
    expect(again.json<TeachingExampleRow>()).toMatchObject({ topic: 'other', editedPrompt: null, betterPrompt: null });
  });

  it('saving the same content again changes nothing, not even updatedAt', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    const first = (await s.put(t, an.prompt.id)).json<TeachingExampleRow>();
    s.clock.advance(60_000);
    const second = (await s.put(t, an.prompt.id)).json<TeachingExampleRow>();
    expect(second).toEqual(first);
    s.clock.advance(60_000);
    expect((await s.put(t, an.prompt.id, { ...BODY, comment: 'khác' })).json<TeachingExampleRow>().updatedAt).toBeGreaterThan(first.updatedAt);
  });

  it('refuses a prompt of a member who did not tick (409 no_teaching_consent), and a member from before the column counts as agreed only via the migration', async () => {
    const s = await setup();
    const t = await s.training();
    const lan = await s.member(t, 'Lan');
    await s.ingest(lan.ingestToken, userPromptSubmit);
    const [prompt] = await s.timeline(t, lan.id);
    const res = await s.put(t, prompt!.id);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'no_teaching_consent' });
    expect(await s.list(t)).toEqual([]);
  });

  it('refuses an event that is not a prompt (400), another training or an unknown event (404), an ended training (409), and a bad body (400)', async () => {
    const s = await setup();
    const a = await s.training();
    const b = await s.training();
    const an = await s.agreed(a);
    expect((await s.put(a, an.tool.id)).statusCode).toBe(400);
    expect((await s.put(b, an.prompt.id)).statusCode).toBe(404);
    expect((await s.put(a, 9999)).statusCode).toBe(404);
    expect((await s.admin('PUT', `/trainings/${a.id}/events/abc/teaching-example`, BODY)).statusCode).toBe(404);
    expect((await s.put(a, an.prompt.id, { ...BODY, label: undefined })).statusCode).toBe(400);
    expect((await s.put(a, an.prompt.id, { ...BODY, comment: '   ' })).statusCode).toBe(400);
    expect((await s.put(a, an.prompt.id, { ...BODY, comment: 'x'.repeat(2001) })).statusCode).toBe(400);
    expect((await s.put(a, an.prompt.id, { ...BODY, editedContext: 'x'.repeat(4001) })).statusCode).toBe(400);
    expect((await s.put(a, an.prompt.id, { ...BODY, topic: 'nope' })).statusCode).toBe(400);
    expect((await s.put(a, an.prompt.id, { ...BODY, comment: 'x'.repeat(2000), editedPrompt: 'y'.repeat(4000) })).statusCode).toBe(200);

    await s.admin('POST', `/trainings/${a.id}/stop`);
    await s.admin('POST', `/trainings/${a.id}/end`);
    expect((await s.put(a, an.prompt.id)).statusCode).toBe(409);
    expect((await s.admin('DELETE', `/trainings/${a.id}/events/${an.prompt.id}/teaching-example`)).statusCode).toBe(409);
  });

  it('needs the mentor', async () => {
    const s = await setup();
    for (const [method, url] of [['PUT', '/events/1/teaching-example'], ['DELETE', '/events/1/teaching-example'], ['GET', '/teaching-examples'], ['GET', '/teaching-examples.md?confirmed=1']] as const) {
      expect((await s.app.inject({ method, url: `/api/admin/trainings/1${url}` })).statusCode).toBe(401);
    }
  });
});

describe('the review list (S44)', () => {
  it('carries the masked prompt and the context of the turn (commands only), next to the mentor edits', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    await s.ingest(an.ingestToken, { ...userPromptSubmit, prompt: 'dùng khoá sk-live-abcdefghijklmnop1234' });
    await s.ingest(an.ingestToken, postToolUseEdit);
    const second = (await s.timeline(t, an.id)).filter(e => e.kind === 'prompt')[1]!;
    await s.put(t, an.prompt.id);
    await s.put(t, second.id, { ...BODY, editedContext: 'đã sửa' });

    const [one, two] = await s.list(t);
    expect(one).toMatchObject({ memberName: 'Nguyễn Văn An', defaultPrompt: 'Viết hàm cộng hai số', defaultContext: '✓ Bash npm test', editedContext: null });
    expect(two!.defaultPrompt).not.toContain('sk-live-abcdefghijklmnop1234');
    expect(two).toMatchObject({ defaultContext: '✓ Edit src/add.ts', editedContext: 'đã sửa' });
    // A command's output or a file's content never reaches the list.
    expect(JSON.stringify([one, two])).not.toContain('Tests: 3 passed');
    expect(JSON.stringify([one, two])).not.toContain('a + b + 0');
  });
});

describe('the file (S44)', () => {
  it('needs confirmed=1 (400 review_not_confirmed) and at least one example (404 no_examples)', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    const empty = await s.file(t);
    expect(empty.statusCode).toBe(404);
    expect(empty.json()).toMatchObject({ code: 'no_examples' });
    await s.put(t, an.prompt.id);
    for (const q of ['', '?confirmed=0', '?confirmed=true']) {
      const res = await s.file(t, q);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'review_not_confirmed' });
    }
    const ok = await s.file(t);
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['content-type']).toBe('text/markdown; charset=utf-8');
    expect(ok.headers['content-disposition']).toBe(`attachment; filename="vi-du-${t.id}.md"`);
    expect(ok.headers['cache-control']).toBe('no-store');
  });

  it('holds no member name, date, session id, output or file content; the edited texts win over the originals', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t, 'Nguyễn Văn An');
    await s.ingest(an.ingestToken, postToolUseEdit);
    await s.put(t, an.prompt.id, { ...BODY, betterPrompt: 'Viết hàm cộng và chạy test' });
    const mai = await s.agreed(t, 'Mai Linh');
    await s.put(t, mai.prompt.id, { ...BODY, label: 'good', topic: 'delegation', editedPrompt: 'Prompt đã bỏ chi tiết', editedContext: '✓ Bash test' });

    const { body } = await s.file(t);
    expect(body).toContain('# Ví dụ prompt để dạy: Buổi 1');
    expect(body).toContain('Chưa nói cách kiểm tra kết quả');
    expect(body).toContain('Viết hàm cộng hai số'); // An's original
    expect(body).toContain('Prompt đã bỏ chi tiết');
    expect(body).toContain('✓ Bash test');
    expect(body).toContain('Viết hàm cộng và chạy test');
    for (const hidden of ['Nguyễn Văn An', 'Văn An', 'Mai Linh', 'Mai', '2026', '24/11', '10:00', SESSION_ID, CWD, 'Tests: 3 passed', 'PASS src/add.test.ts', 'a + b + 0', 'Run tests']) {
      expect(body, hidden).not.toContain(hidden);
    }
    expect(body).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('does not count as exporting the report', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    await s.put(t, an.prompt.id);
    expect((await s.file(t)).statusCode).toBe(200);
    expect((await s.detail(t.id)).reportExportedAt).toBeNull();
  });

  it('keeps a member who stopped sending until the mentor purges them, then the example is gone with them', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    const mai = await s.agreed(t, 'Mai');
    await s.put(t, an.prompt.id);
    await s.put(t, mai.prompt.id, { ...BODY, comment: 'Của Mai' });
    await s.app.inject({ method: 'DELETE', url: '/api/training/me', headers: { 'x-training-member-token': an.token }, remoteAddress: LAN });

    const before = (await s.file(t)).body;
    expect(before).toContain('Chưa nói cách kiểm tra');
    expect(before).toContain('Của Mai');
    expect(await s.list(t)).toHaveLength(2);

    await s.admin('POST', `/trainings/${t.id}/members/${an.id}/purge`);
    const after = (await s.file(t)).body;
    expect(after).not.toContain('Chưa nói cách kiểm tra');
    expect(after).toContain('Của Mai');
    expect(await s.list(t)).toHaveLength(1);
  });

  it('is deleted with everything else when the training ends', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    await s.put(t, an.prompt.id);
    await s.admin('POST', `/trainings/${t.id}/stop`);
    await s.admin('POST', `/trainings/${t.id}/end`);
    expect((await s.file(t)).statusCode).toBe(409);
    expect((await s.admin('GET', `/trainings/${t.id}/teaching-examples`)).statusCode).toBe(409);
    expect(s.db.$client.prepare('select count(*) as n from training_teaching_examples').get()).toEqual({ n: 0 });
  });
});

describe('the reminder before ending (S44)', () => {
  it('counts examples never downloaded, drops to 0 after a download, and counts again an example saved or edited after it', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    const mai = await s.agreed(t, 'Mai');
    expect((await s.detail(t.id)).unexportedExampleCount).toBe(0);

    await s.put(t, an.prompt.id);
    await s.put(t, mai.prompt.id);
    expect((await s.detail(t.id)).unexportedExampleCount).toBe(2);

    s.clock.advance(1000);
    expect((await s.file(t, '?confirmed=0')).statusCode).toBe(400); // a refused download exports nothing
    expect((await s.detail(t.id)).unexportedExampleCount).toBe(2);
    expect((await s.file(t)).statusCode).toBe(200);
    expect((await s.detail(t.id)).unexportedExampleCount).toBe(0);

    s.clock.advance(1000);
    await s.put(t, an.prompt.id, { ...BODY, comment: 'sửa sau khi xuất' });
    expect((await s.detail(t.id)).unexportedExampleCount).toBe(1);
    s.clock.advance(1000);
    await s.put(t, an.prompt.id, { ...BODY, comment: 'sửa sau khi xuất' }); // unchanged: still 1, not 2
    expect((await s.detail(t.id)).unexportedExampleCount).toBe(1);
    await s.admin('DELETE', `/trainings/${t.id}/events/${an.prompt.id}/teaching-example`);
    expect((await s.detail(t.id)).unexportedExampleCount).toBe(0);
  });

  it('exporting the examples does not touch the report export time', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    await s.put(t, an.prompt.id);
    await s.file(t);
    const d = await s.detail(t.id);
    expect(d.reportExportedAt).toBeNull();
    expect(d.unexportedExampleCount).toBe(0);
  });
});

describe('nothing leaks elsewhere (S44)', () => {
  it('label, comment and example do not appear in the report, the zip, the member row, the flags or any member route', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    const COMMENT = 'NHẬN-XÉT-RIÊNG-S44';
    await s.put(t, an.prompt.id, { ...BODY, comment: COMMENT, betterPrompt: 'BẢN-TỐT-S44', editedPrompt: 'SỬA-S44' });

    const report = await s.admin('GET', `/trainings/${t.id}/report.md`);
    const zip = readZip((await s.admin('GET', `/trainings/${t.id}/export.zip`)).rawPayload);
    const zipText = [...zip.values()].join('\n');
    const detailText = JSON.stringify(await s.detail(t.id));
    for (const text of [report.body, zipText, detailText]) {
      for (const mark of [COMMENT, 'BẢN-TỐT-S44', 'SỬA-S44']) expect(text).not.toContain(mark);
    }
    expect(detailText).not.toContain('needs_work');
    expect(detailText).not.toContain('teachingExample');

    const me = await s.app.inject({ method: 'GET', url: '/api/training/me', headers: { 'x-training-member-token': an.token }, remoteAddress: LAN });
    expect(JSON.stringify(me.json())).not.toMatch(/teaching|needs_work|NHẬN-XÉT/);
    const hook = await s.app.inject({ method: 'GET', url: '/api/training/me/hook-config', headers: { 'x-training-member-token': an.token }, remoteAddress: LAN });
    expect(hook.body).not.toMatch(/teaching|needs_work|NHẬN-XÉT/);
  });
});
