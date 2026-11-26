import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import type { CreatedTraining, ExampleDraftRow, TeachingExampleRow, TeachingExamplesResponse, TrainingDetail, TrainingEventRow, TrainingEventsPage } from '../../../shared/api/index.js';
import { FakeExampleDrafter } from '../../application/testing/fake-example-drafter.js';
import { FakeClock } from '../../application/testing/fakes.js';
import { ExampleDrafterError } from '../../application/ports/teaching-example-drafter.js';
import { postToolUseBash, userPromptSubmit } from '../../domain/training/fixtures/hook-payloads.js';
import { trainingExampleDrafts, trainingMembers, trainingTeachingExamples } from '../../infrastructure/db/schema.js';
import { readZip } from '../../infrastructure/system/zip-test-reader.js';
import { createTestApp, loginAsMentor } from '../helpers.js';

// AI drafts of teaching examples over HTTP (S45). The AI is a fake: nothing here reaches a real one.
const LAN = '192.168.1.50';
const FAKE_CLI = fileURLToPath(new URL('../../infrastructure/ai-grader/testing/fake-claude-cli.mjs', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'pq-draft-int-'));

async function setup(opts: { cli?: boolean; aiOff?: boolean } = {}) {
  const clock = new FakeClock(new Date(2026, 10, 26, 10, 0).getTime());
  const drafter = new FakeExampleDrafter();
  drafter.isAvailable = !opts.aiOff;
  let ai: { drafter?: FakeExampleDrafter; configPath?: string } = { drafter, configPath: 'config/__tests_have_no_ai__.json' };
  if (opts.cli) {
    const path = join(dir, `cli-${Math.random()}.json`);
    writeFileSync(path, JSON.stringify({ command: process.execPath, args: [FAKE_CLI] }));
    ai = { configPath: path };
  }
  const { app, db, composition } = await createTestApp({ ports: { clock }, ai });
  const headers = await loginAsMentor(app);
  const admin = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) => app.inject({ method, url: `/api/admin${url}`, headers, payload });
  const training = async () => (await admin('POST', '/trainings', { name: 'Buổi 1' })).json<CreatedTraining>();
  const member = async (t: CreatedTraining, displayName: string, teachingConsent = true) => {
    const res = await app.inject({ method: 'POST', url: `/api/trainings/${t.id}/join`, remoteAddress: LAN, payload: { displayName, roomCode: t.roomCode, consent: true, teachingConsent } });
    expect(res.statusCode).toBe(201);
    const token = res.json<{ token: string }>().token;
    const row = db.select().from(trainingMembers).where(eq(trainingMembers.token, token)).get()!;
    return { token, ingestToken: row.ingestToken, id: row.id };
  };
  const ingest = (token: string, payload: unknown) =>
    app.inject({ method: 'POST', url: '/api/training/ingest', headers: { 'x-training-token': token, 'content-type': 'application/json' }, payload: JSON.stringify(payload), remoteAddress: LAN });
  const timeline = async (t: CreatedTraining, memberId: number): Promise<TrainingEventRow[]> => (await admin('GET', `/trainings/${t.id}/members/${memberId}/events`)).json<TrainingEventsPage>().events;
  const detail = async (t: CreatedTraining) => (await admin('GET', `/trainings/${t.id}`)).json<TrainingDetail>();
  const agreed = async (t: CreatedTraining, name = 'Nguyễn Văn An') => {
    const m = await member(t, name);
    await ingest(m.ingestToken, userPromptSubmit);
    await ingest(m.ingestToken, postToolUseBash);
    const [prompt, tool] = await timeline(t, m.id);
    return { ...m, prompt: prompt!, tool: tool! };
  };
  const draftUrl = (t: CreatedTraining, eventId: number) => `/trainings/${t.id}/events/${eventId}/example-draft`;
  const request = (t: CreatedTraining, eventId: number) => admin('POST', draftUrl(t, eventId));
  const get = (t: CreatedTraining, eventId: number) => admin('GET', draftUrl(t, eventId));
  const put = (t: CreatedTraining, eventId: number, body: object) => admin('PUT', `/trainings/${t.id}/events/${eventId}/teaching-example`, body);
  const list = async (t: CreatedTraining) => (await admin('GET', `/trainings/${t.id}/teaching-examples`)).json<TeachingExamplesResponse>().examples;
  const origins = () => db.select({ origin: trainingTeachingExamples.origin, aiDraft: trainingTeachingExamples.aiDraft, reviewedAt: trainingTeachingExamples.reviewedAt, updatedAt: trainingTeachingExamples.updatedAt }).from(trainingTeachingExamples).all();
  return { app, db, composition, clock, drafter, admin, training, member, ingest, timeline, detail, agreed, request, get, put, list, origins, draftUrl };
}

/** Holds the fake AI until the test lets it answer, so the draft stays running while the test acts. */
function hold(drafter: FakeExampleDrafter) {
  let release!: () => void;
  const gate = new Promise<void>(resolve => (release = resolve));
  const answer = drafter.answer;
  drafter.answer = async () => {
    await gate;
    if (answer instanceof Error) throw answer;
    return typeof answer === 'function' ? answer() : answer;
  };
  const started = () => vi.waitFor(() => expect(drafter.inputs.length).toBeGreaterThan(0));
  return { release, started };
}

const SAVE = { label: 'needs_work', topic: 'verify', comment: 'Chưa nói cách kiểm tra', betterPrompt: 'Prompt tốt hơn' };

describe('without the AI (S45 AC1)', () => {
  it('says so in the detail, refuses a draft with 503 ai_unavailable, and saving an example works as before', async () => {
    const s = await setup({ aiOff: true });
    const t = await s.training();
    const an = await s.agreed(t);
    expect((await s.detail(t)).aiDraftAvailable).toBe(false);
    const res = await s.request(t, an.prompt.id);
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: 'ai_unavailable' });
    expect((await s.get(t, an.prompt.id)).statusCode).toBe(404);
    expect((await s.put(t, an.prompt.id, SAVE)).statusCode).toBe(200);
    expect(s.drafter.inputs).toEqual([]);
  });

  it('is off with no config file even without a fake drafter', async () => {
    const { app } = await createTestApp();
    const headers = await loginAsMentor(app);
    const t = (await app.inject({ method: 'POST', url: '/api/admin/trainings', headers, payload: { name: 'T' } })).json<CreatedTraining>();
    expect((await app.inject({ url: `/api/admin/trainings/${t.id}`, headers })).json<TrainingDetail>().aiDraftAvailable).toBe(false);
  });
});

describe('asking for a draft (S45)', () => {
  it('answers 202 queued at once, finishes in the background, and shows in the row, the member and the training', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    expect((await s.detail(t)).aiDraftAvailable).toBe(true);

    const res = await s.request(t, an.prompt.id);
    expect(res.statusCode).toBe(202);
    expect(res.json<ExampleDraftRow>()).toMatchObject({ eventId: an.prompt.id, status: 'queued', draft: null, sampleCount: null, error: null, seen: false });
    expect(Number.isNaN(Date.parse(res.json<ExampleDraftRow>().createdAt))).toBe(false);

    await s.composition.ai.idle();
    const done = (await s.get(t, an.prompt.id)).json<ExampleDraftRow>();
    expect(done).toMatchObject({
      status: 'done', sampleCount: 0, error: null, seen: false,
      draft: { label: 'needs_work', topic: 'verify', comment: 'Chưa nói cách kiểm tra', betterPrompt: 'Prompt tốt hơn', suspicious: false, suspiciousQuote: '' },
    });
    expect((await s.timeline(t, an.id))[0]!.exampleDraft).toEqual({ status: 'done', seen: false, suspicious: false, error: null });
    expect((await s.timeline(t, an.id))[1]!.exampleDraft).toBeNull();
    const d = await s.detail(t);
    expect(d.exampleDrafts).toEqual({ drafting: 0, unseen: 1, failed: 0, next: { memberId: an.id, eventId: an.prompt.id } });
    expect(d.members[0]!.exampleDrafts).toEqual({ drafting: 0, unseen: 1, failed: 0 });
    expect(await s.list(t)).toEqual([]); // nothing is saved until the mentor saves

    expect((await s.admin('PUT', `${s.draftUrl(t, an.prompt.id)}/seen`)).statusCode).toBe(204);
    expect((await s.get(t, an.prompt.id)).json<ExampleDraftRow>().seen).toBe(true);
    expect((await s.detail(t)).exampleDrafts).toEqual({ drafting: 0, unseen: 0, failed: 0, next: null });
  });

  it('runs only once for two requests while it is queued', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    const gate = hold(s.drafter);
    await s.request(t, an.prompt.id);
    await gate.started();
    const again = await s.request(t, an.prompt.id); // running now: answered with the current state, not queued again
    expect(again.statusCode).toBe(202);
    expect(again.json<ExampleDraftRow>().status).toBe('running');
    gate.release();
    await s.composition.ai.idle();
    expect(s.drafter.inputs).toHaveLength(1);
  });

  it('sends the AI no name, id or time, and the earlier prompts and the samples of this training', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    await s.ingest(an.ingestToken, { ...userPromptSubmit, prompt: 'prompt thứ hai với khoá sk-live-abcdefghijklmnop1234' });
    const second = (await s.timeline(t, an.id)).filter(e => e.kind === 'prompt')[1]!;
    await s.put(t, an.prompt.id, SAVE);
    await s.request(t, second.id);
    await s.composition.ai.idle();
    const [input] = s.drafter.inputs;
    expect(input).toMatchObject({ earlierPrompts: ['Viết hàm cộng hai số'], samples: [{ prompt: 'Viết hàm cộng hai số', label: 'needs_work', comment: SAVE.comment }] });
    expect(input!.prompt).not.toContain('sk-live-abcdefghijklmnop1234');
    const sent = JSON.stringify(input);
    for (const leaked of ['Nguyễn Văn An', 'Buổi 1', '2026', String(an.id), 'Tests: 3 passed']) expect(sent).not.toContain(leaked);
    expect((await s.get(t, second.id)).json<ExampleDraftRow>().sampleCount).toBe(1);
  });

  it('reports a failure with the short Vietnamese reason, and "Viết lại nháp" runs again', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    s.drafter.answer = new ExampleDrafterError('timeout');
    await s.request(t, an.prompt.id);
    await s.composition.ai.idle();
    expect((await s.get(t, an.prompt.id)).json<ExampleDraftRow>()).toMatchObject({ status: 'failed', error: 'Quá thời gian', draft: null });
    expect((await s.timeline(t, an.id))[0]!.exampleDraft).toEqual({ status: 'failed', seen: false, suspicious: false, error: 'Quá thời gian' });
    expect((await s.detail(t)).exampleDrafts).toMatchObject({ failed: 1, unseen: 0, next: null });

    s.drafter.answer = { label: 'good', topic: 'other', comment: 'Ổn', betterPrompt: '', suspicious: false, suspiciousReason: '', suspiciousQuote: '', model: null };
    await s.request(t, an.prompt.id);
    await s.composition.ai.idle();
    expect((await s.get(t, an.prompt.id)).json<ExampleDraftRow>()).toMatchObject({ status: 'done', error: null, draft: { label: 'good', betterPrompt: null } });
  });

  it('marks a suspicious prompt and keeps the quote only when it is in the prompt', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    s.drafter.answer = { label: 'good', topic: 'other', comment: 'Ổn', betterPrompt: '', suspicious: true, suspiciousReason: 'Câu nhắm vào người đánh giá', suspiciousQuote: 'Viết hàm cộng', model: null };
    await s.request(t, an.prompt.id);
    await s.composition.ai.idle();
    expect((await s.get(t, an.prompt.id)).json<ExampleDraftRow>().draft).toMatchObject({ suspicious: true, suspiciousReason: 'Câu nhắm vào người đánh giá', suspiciousQuote: 'Viết hàm cộng' });
    expect((await s.timeline(t, an.id))[0]!.exampleDraft).toMatchObject({ suspicious: true });

    s.drafter.answer = { ...(s.drafter.answer as object), suspiciousQuote: 'câu không có trong prompt' } as never;
    await s.request(t, an.prompt.id);
    await s.composition.ai.idle();
    expect((await s.get(t, an.prompt.id)).json<ExampleDraftRow>().draft).toMatchObject({ suspicious: true, suspiciousQuote: '' });
  });

  it('is deleted by DELETE (idempotent), and with the training when it ends', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    await s.request(t, an.prompt.id);
    await s.composition.ai.idle();
    for (let i = 0; i < 2; i++) expect((await s.admin('DELETE', s.draftUrl(t, an.prompt.id))).statusCode).toBe(204);
    expect((await s.get(t, an.prompt.id)).statusCode).toBe(404);
    expect((await s.get(t, an.prompt.id)).json()).toMatchObject({ code: 'no_draft' });
    expect((await s.admin('PUT', `${s.draftUrl(t, an.prompt.id)}/seen`)).statusCode).toBe(404);

    await s.request(t, an.prompt.id);
    await s.composition.ai.idle();
    await s.admin('POST', `/trainings/${t.id}/stop`);
    await s.admin('POST', `/trainings/${t.id}/end`);
    expect(s.db.$client.prepare('select count(*) as n from training_example_drafts').get()).toEqual({ n: 0 });
  });

  it('after a restart the leftover drafts are failed "Server đã khởi động lại", and can be asked for again', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    s.db.insert(trainingExampleDrafts).values({ eventId: an.prompt.id, status: 'running', createdAt: new Date() }).run();
    expect(await s.composition.ai.failUnfinishedDrafts.execute()).toBe(1);
    expect((await s.get(t, an.prompt.id)).json<ExampleDraftRow>()).toMatchObject({ status: 'failed', error: 'Server đã khởi động lại' });
    await s.request(t, an.prompt.id);
    await s.composition.ai.idle();
    expect((await s.get(t, an.prompt.id)).json<ExampleDraftRow>().status).toBe('done');
  });

  it('works with the real adapter and a fake CLI, the same configuration file as the grader', async () => {
    const s = await setup({ cli: true });
    const t = await s.training();
    const an = await s.agreed(t);
    expect((await s.detail(t)).aiDraftAvailable).toBe(true);
    await s.request(t, an.prompt.id);
    await s.composition.ai.idle();
    expect((await s.get(t, an.prompt.id)).json<ExampleDraftRow>()).toMatchObject({ status: 'done', sampleCount: 0, draft: { label: 'needs_work', topic: 'verify' } });
  });
});

describe('refusals (S45 AC10)', () => {
  it('400 not_a_prompt, 409 no_teaching_consent, 404 unknown or foreign event, 409 ended, 401 without the mentor', async () => {
    const s = await setup();
    const a = await s.training();
    const b = await s.training();
    const an = await s.agreed(a);
    const lan = await s.member(a, 'Lan', false);
    await s.ingest(lan.ingestToken, userPromptSubmit);
    const [lanPrompt] = await s.timeline(a, lan.id);

    const notPrompt = await s.request(a, an.tool.id);
    expect(notPrompt.statusCode).toBe(400);
    expect(notPrompt.json()).toMatchObject({ code: 'not_a_prompt' });
    const noConsent = await s.request(a, lanPrompt!.id);
    expect(noConsent.statusCode).toBe(409);
    expect(noConsent.json()).toMatchObject({ code: 'no_teaching_consent' });
    expect((await s.request(a, 9999)).statusCode).toBe(404);
    expect((await s.request(b, an.prompt.id)).statusCode).toBe(404);
    expect((await s.admin('GET', `/trainings/${b.id}/events/${an.prompt.id}/example-draft`)).statusCode).toBe(404);
    expect((await s.admin('POST', `/trainings/${a.id}/events/abc/example-draft`)).statusCode).toBe(404);
    expect(s.drafter.inputs).toEqual([]);

    await s.admin('POST', `/trainings/${a.id}/stop`);
    await s.admin('POST', `/trainings/${a.id}/end`);
    for (const [method, url] of [['POST', ''], ['GET', ''], ['DELETE', ''], ['PUT', '/seen']] as const) {
      expect((await s.admin(method, `${s.draftUrl(a, an.prompt.id)}${url}`)).statusCode, `${method}${url}`).toBe(409);
    }

    for (const [method, url] of [['POST', ''], ['GET', ''], ['DELETE', ''], ['PUT', '/seen']] as const) {
      expect((await s.app.inject({ method, url: `/api/admin/trainings/1/events/1/example-draft${url}` })).statusCode).toBe(401);
    }
  });
});

describe('saving an example that started as a draft (S45)', () => {
  it('copies the draft, computes the origin, and deletes the draft: kept, edited, and the mentor’s own', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    await s.ingest(an.ingestToken, { ...userPromptSubmit, prompt: 'hai' });
    await s.ingest(an.ingestToken, { ...userPromptSubmit, prompt: 'ba' });
    const [p1, p2, p3] = (await s.timeline(t, an.id)).filter(e => e.kind === 'prompt');

    for (const e of [p1!, p2!]) {
      await s.request(t, e.id);
      await s.composition.ai.idle();
    }
    // kept: the same four fields (the comment may carry spaces)
    expect((await s.put(t, p1!.id, { ...SAVE, comment: `  ${SAVE.comment} ` })).statusCode).toBe(200);
    // edited: the label changed
    expect((await s.put(t, p2!.id, { ...SAVE, label: 'good' })).statusCode).toBe(200);
    // the mentor's own: no draft at all
    expect((await s.put(t, p3!.id, SAVE)).statusCode).toBe(200);

    expect((await s.get(t, p1!.id)).statusCode).toBe(404);
    expect((await s.get(t, p2!.id)).statusCode).toBe(404);
    const rows = s.db.select().from(trainingTeachingExamples).orderBy(trainingTeachingExamples.eventId).all();
    expect(rows.map(r => r.origin)).toEqual(['ai_kept', 'ai_edited', 'mentor']);
    expect(rows[0]!.aiDraft).toEqual({ label: 'needs_work', topic: 'verify', comment: SAVE.comment, betterPrompt: 'Prompt tốt hơn' });
    expect(rows[2]!.aiDraft).toBeNull();
    expect((await s.timeline(t, an.id))[0]!.exampleDraft).toBeNull();
  });

  it('editing a kept example on the review screen makes it ai_edited, and a change of origin alone leaves reviewed and updated times', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    await s.request(t, an.prompt.id);
    await s.composition.ai.idle();
    const first = (await s.put(t, an.prompt.id, SAVE)).json<TeachingExampleRow>();
    expect(s.origins()[0]).toMatchObject({ origin: 'ai_kept' });
    await s.admin('PUT', `/trainings/${t.id}/events/${an.prompt.id}/teaching-example/reviewed`);
    const reviewedAt = s.origins()[0]!.reviewedAt;
    expect(reviewedAt).not.toBeNull();

    // same content saved again: nothing changes
    s.clock.advance(60_000);
    const again = (await s.put(t, an.prompt.id, SAVE)).json<TeachingExampleRow>();
    expect(again.updatedAt).toBe(first.updatedAt);
    expect(again.reviewed).toBe(true);

    // an edit on the review screen (no draft any more): the ai_draft stays, the origin is recomputed
    s.clock.advance(60_000);
    const edited = (await s.put(t, an.prompt.id, { ...SAVE, comment: 'Sửa ở màn rà' })).json<TeachingExampleRow>();
    expect(edited.reviewed).toBe(false);
    expect(edited.updatedAt).toBeGreaterThan(first.updatedAt);
    expect(s.origins()[0]).toMatchObject({ origin: 'ai_edited', aiDraft: { comment: SAVE.comment } });
  });

  it('a kept example turns ai_edited when it is edited on the review screen', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    await s.request(t, an.prompt.id);
    await s.composition.ai.idle();
    await s.put(t, an.prompt.id, SAVE);
    expect(s.origins()[0]!.origin).toBe('ai_kept');
    await s.put(t, an.prompt.id, { ...SAVE, betterPrompt: 'Tự sửa' });
    expect(s.origins()[0]!.origin).toBe('ai_edited');
  });

  it('a draft still being written when the mentor saves is cancelled: the example is the mentor’s', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    const gate = hold(s.drafter);
    await s.request(t, an.prompt.id);
    await gate.started();
    await s.put(t, an.prompt.id, SAVE); // while the AI is still writing
    gate.release();
    await s.composition.ai.idle();
    expect((await s.get(t, an.prompt.id)).statusCode).toBe(404); // its late answer was dropped
    expect(s.origins()[0]).toMatchObject({ origin: 'mentor', aiDraft: null });
  });

  it('does not use an example kept as the AI wrote it as a sample for the next draft', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    await s.ingest(an.ingestToken, { ...userPromptSubmit, prompt: 'prompt hai' });
    const [p1, p2] = (await s.timeline(t, an.id)).filter(e => e.kind === 'prompt');
    await s.request(t, p1!.id);
    await s.composition.ai.idle();
    await s.put(t, p1!.id, SAVE); // kept
    await s.request(t, p2!.id);
    await s.composition.ai.idle();
    expect(s.drafter.inputs[1]!.samples).toEqual([]);
    expect((await s.get(t, p2!.id)).json<ExampleDraftRow>().sampleCount).toBe(0);
  });
});

describe('nothing about the AI leaks outside /api/admin (S45 AC11)', () => {
  it('refuses a draft for a prompt that already has an example (409 example_exists)', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    await s.put(t, an.prompt.id, SAVE);
    const res = await s.request(t, an.prompt.id);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'example_exists' });
    expect((await s.get(t, an.prompt.id)).statusCode).toBe(404);
  });

  it('the member routes, the report, the zip and the example file and review rows carry no draft, origin or availability', async () => {
    const s = await setup();
    const t = await s.training();
    const an = await s.agreed(t);
    const MARK = 'NHẬN-XÉT-NHÁP-S45';
    s.drafter.answer = { label: 'needs_work', topic: 'verify', comment: MARK, betterPrompt: 'BẢN-NHÁP-S45', suspicious: false, suspiciousReason: '', suspiciousQuote: '', model: null };
    await s.request(t, an.prompt.id);
    await s.composition.ai.idle();
    await s.put(t, an.prompt.id, { ...SAVE, comment: MARK, betterPrompt: 'BẢN-NHÁP-S45' });
    await s.ingest(an.ingestToken, { ...userPromptSubmit, prompt: 'prompt thứ hai' });
    const second = (await s.timeline(t, an.id)).filter(e => e.kind === 'prompt')[1]!;
    await s.request(t, second.id); // a live draft of another prompt, beside the saved example
    await s.composition.ai.idle();
    const review = await s.admin('PUT', `/trainings/${t.id}/events/${an.prompt.id}/teaching-example/reviewed`);
    expect(review.statusCode).toBe(204);

    const file = (await s.admin('GET', `/trainings/${t.id}/teaching-examples.md`)).body;
    const report = (await s.admin('GET', `/trainings/${t.id}/report.md`)).body;
    const zip = [...readZip((await s.admin('GET', `/trainings/${t.id}/export.zip`)).rawPayload).values()].join('\n');
    const rows = JSON.stringify(await s.list(t));
    const me = await s.app.inject({ method: 'GET', url: '/api/training/me', headers: { 'x-training-member-token': an.token }, remoteAddress: LAN });
    const hook = await s.app.inject({ method: 'GET', url: '/api/training/me/hook-config', headers: { 'x-training-member-token': an.token }, remoteAddress: LAN });
    const sessions = await s.app.inject({ method: 'GET', url: '/api/sessions', remoteAddress: LAN });
    for (const [name, text] of Object.entries({ file, report, zip, rows, me: me.body, hook: hook.body, sessions: sessions.body })) {
      expect(text, name).not.toMatch(/exampleDraft|aiDraft|ai_draft|aiDraftAvailable|ai_kept|ai_edited|"origin"|example-draft/);
    }
    for (const text of [report, zip, me.body, hook.body, sessions.body]) expect(text).not.toContain(MARK);
    // the draft text only travels on the mentor's own draft route
    expect((await s.get(t, second.id)).body).toContain(MARK);
  });
});
