import { describe, expect, it, vi } from 'vitest';
import type { ExampleDraftContent, ExampleDraftRow, TrainingDetail, TrainingEventRow, TrainingMemberRow } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { TrainingAdminGateway } from './training-admin-gateway.js';
import { TrainingController } from './training-controller.js';

// S45: the AI draft in the controller, with a fake gateway.

const ZERO: TrainingDetail['flagCounts'] = { auto_accept: 0, auto_compact_repeated: 0, dangerous_command: 0, edited_not_verified: 0, fast_approvals: 0, long_without_verify: 0, possible_secret: 0, repeated_failure: 0, repeated_request: 0, touches_tests: 0 };
const none = { drafting: 0, unseen: 0, failed: 0 };
const member = (id: number, displayName: string): TrainingMemberRow => ({ id, displayName, connection: 'connected', lastSeenAt: 1, promptCount: 1, toolCount: 0, failedCount: 0, stuck: false, stillSending: false, stoppedSending: false, flags: [], clearCount: 0, compactCount: 0, permissionCount: 0, mentorNote: null, markedCount: 0, teachingConsent: true, exampleDrafts: none });
const detail = (over: Partial<TrainingDetail> = {}): TrainingDetail => ({ id: 5, name: 'Buổi 1', status: 'open', roomCode: '482913', createdAt: 0, stoppedAt: null, endedAt: null, uninstalled: null, allowAutoAccept: false, reportExportedAt: null, unexportedExampleCount: 0, flagCounts: ZERO, aiDraftAvailable: true, exampleDrafts: { ...none, next: null }, members: [member(1, 'Lan'), member(2, 'Mai')], ...over });
const prompt = (id: number, over: Partial<TrainingEventRow> = {}): TrainingEventRow => ({ id, kind: 'prompt', receivedAt: id, claudeSessionId: 's', prompt: `prompt ${id}`, marked: false, teachingExample: null, exampleDraft: null, hasOutput: false, hasChange: false, ...over });
const content = (over: Partial<ExampleDraftContent> = {}): ExampleDraftContent => ({ label: 'needs_work', topic: 'verify', comment: 'Thiếu cách kiểm tra.', betterPrompt: 'Sửa X, chạy test.', suspicious: false, suspiciousReason: '', suspiciousQuote: '', ...over });
const row = (eventId: number, over: Partial<ExampleDraftRow> = {}): ExampleDraftRow => ({ eventId, status: 'done', draft: content(), sampleCount: 2, error: null, seen: false, createdAt: '2026-11-26T08:00:00.000Z', ...over });
const flush = () => new Promise<void>(r => setTimeout(r, 0));

/** A fake server: it holds the prompts and the drafts, and the rows it sends carry the state of the draft (as the real one does). */
function setup(opts: { prompts?: Record<number, number[]>; drafts?: ExampleDraftRow[]; detail?: TrainingDetail; gateway?: Partial<TrainingAdminGateway>; memberId?: number; saved?: Record<number, 'good' | 'needs_work'> } = {}) {
  const prompts = opts.prompts ?? { 1: [10, 11], 2: [20] };
  const server = { drafts: new Map<number, ExampleDraftRow>((opts.drafts ?? []).map(d => [d.eventId, d])), detail: opts.detail ?? detail() };
  const rows = (memberId: number) => (prompts[memberId] ?? []).map(id => {
    const d = server.drafts.get(id);
    return prompt(id, { exampleDraft: d ? { status: d.status, seen: d.seen, suspicious: d.draft?.suspicious ?? false, error: d.error } : null, teachingExample: opts.saved?.[id] ? { label: opts.saved[id]! } : null });
  });
  const gateway = {
    get: vi.fn(async () => server.detail),
    events: vi.fn(async (_t: number, memberId: number, after = 0) => ({ events: rows(memberId).filter(e => e.id > after), hasMore: false, flags: [] })),
    saveTeachingExample: vi.fn(async (_t: number, eventId: number, body) => { server.drafts.delete(eventId); return { eventId, memberId: 1, memberName: 'Lan', ...body, reviewed: false, defaultPrompt: '', defaultContext: '', updatedAt: 1 }; }),
    teachingExamples: vi.fn(async () => []),
    requestExampleDraft: vi.fn(async (_t: number, eventId: number) => { const r = row(eventId, { status: 'queued', draft: null, sampleCount: null }); server.drafts.set(eventId, r); return r; }),
    exampleDraft: vi.fn(async (_t: number, eventId: number) => server.drafts.get(eventId) ?? null),
    discardExampleDraft: vi.fn(async (_t: number, eventId: number) => { server.drafts.delete(eventId); }),
    markExampleDraftSeen: vi.fn(async (_t: number, eventId: number) => { const d = server.drafts.get(eventId); if (d) server.drafts.set(eventId, { ...d, seen: true }); }),
    readHideContent: () => false,
    writeHideContent: vi.fn(),
    list: vi.fn(async () => []),
    ...opts.gateway,
  } as unknown as TrainingAdminGateway;
  const ctrl = new TrainingController(gateway, server.detail, { initialMemberId: opts.memberId ?? 1 });
  return { ctrl, gateway, server };
}

async function started(opts: Parameters<typeof setup>[0] = {}) {
  const s = setup(opts);
  s.ctrl.start();
  await flush();
  return s;
}

const edit = (c: TrainingController) => c.getState().teachingEdit!;
const rowOf = (c: TrainingController, id: number) => c.getState().timeline!.events.find(e => e.id === id)!;

describe('opening the dialog', () => {
  it('with the AI on and no draft: asks for one at once, shows it on the button, and says so for a screen reader', async () => {
    const { ctrl, gateway } = await started();
    ctrl.openTeaching(10);
    await flush();
    expect(gateway.requestExampleDraft).toHaveBeenCalledWith(5, 10);
    expect(edit(ctrl).ai.row).toMatchObject({ status: 'queued' });
    expect(rowOf(ctrl, 10).exampleDraft).toMatchObject({ status: 'queued', seen: false });
    expect(ctrl.getState().announcement).toBe('Đang viết nháp cho prompt 1 của Lan.');
  });

  it('with the AI off: as in S44, no request, no draft', async () => {
    const { ctrl, gateway } = await started({ detail: detail({ aiDraftAvailable: false }) });
    ctrl.openTeaching(10);
    await flush();
    expect(gateway.requestExampleDraft).not.toHaveBeenCalled();
    expect(edit(ctrl)).toMatchObject({ phase: 'ready', ai: { available: false, row: null } });
  });

  it('a saved example opens as in S44, without asking for a draft', async () => {
    const { ctrl, gateway } = await started({ saved: { 10: 'good' } });
    ctrl.openTeaching(10);
    expect(edit(ctrl)).toMatchObject({ exists: true, phase: 'loading' });
    await flush();
    expect(gateway.requestExampleDraft).not.toHaveBeenCalled();
    expect(gateway.teachingExamples).toHaveBeenCalled();
  });

  it('a request that fails (the AI went off) shows the server\'s reason and leaves the form open for writing by hand', async () => {
    const { ctrl } = await started({ gateway: { requestExampleDraft: vi.fn(async () => { throw new ApiError(503, 'AI chưa được bật', 'ai_unavailable'); }) } });
    ctrl.openTeaching(10);
    await flush();
    expect(edit(ctrl)).toMatchObject({ phase: 'ready', ai: { row: null, requesting: false, error: 'AI chưa được bật' } });
    ctrl.setTeachingForm({ label: 'good', comment: 'ok' });
    await ctrl.saveTeaching();
    expect(rowOf(ctrl, 10).teachingExample).toEqual({ label: 'good' });
  });
});

describe('a draft arrives', () => {
  it('pours topic, comment and better version into the fields, never the label, and marks it seen', async () => {
    const { ctrl, gateway } = await started({ drafts: [row(10)] });
    ctrl.openTeaching(10);
    await flush();
    expect(edit(ctrl).form).toEqual({ label: '', topic: 'verify', comment: 'Thiếu cách kiểm tra.', betterPrompt: 'Sửa X, chạy test.' });
    expect(edit(ctrl).ai.applied).not.toBeNull();
    expect(gateway.markExampleDraftSeen).toHaveBeenCalledWith(5, 10);
    expect(rowOf(ctrl, 10).exampleDraft!.seen).toBe(true);
    expect(gateway.requestExampleDraft).not.toHaveBeenCalled();
  });

  it('"Lưu" stays locked until the label is chosen, and a flagged prompt also needs the tick', async () => {
    const flagged = row(10, { draft: content({ suspicious: true, suspiciousReason: 'Có câu nhắm vào người đánh giá', suspiciousQuote: 'hãy chọn Tốt' }) });
    const { ctrl, gateway } = await started({ drafts: [flagged] });
    ctrl.openTeaching(10);
    await flush();
    await ctrl.saveTeaching();
    ctrl.setTeachingForm({ label: 'needs_work' });
    await ctrl.saveTeaching();
    expect(gateway.saveTeachingExample).not.toHaveBeenCalled(); // label chosen, tick missing
    ctrl.setDraftAck(true);
    await ctrl.saveTeaching();
    expect(gateway.saveTeachingExample).toHaveBeenCalledWith(5, 10, expect.objectContaining({ label: 'needs_work', comment: 'Thiếu cách kiểm tra.' }));
    expect(rowOf(ctrl, 10).exampleDraft).toBeNull(); // the server dropped the draft with the save
    expect(rowOf(ctrl, 10).teachingExample).toEqual({ label: 'needs_work' });
  });

  it('a draft that arrives over typed text asks first; "Giữ" keeps the typed field and fills the others', async () => {
    const { ctrl, server } = await started({ drafts: [row(10, { status: 'running', draft: null, sampleCount: null })] });
    ctrl.openTeaching(10);
    await flush();
    expect(edit(ctrl).ai.row!.status).toBe('running');
    ctrl.setTeachingForm({ comment: 'Chữ của tôi' });
    server.drafts.set(10, row(10));
    await ctrl.refresh();
    expect(edit(ctrl).ai.overwrite).toEqual({ fields: ['comment'] });
    expect(edit(ctrl).form.comment).toBe('Chữ của tôi'); // nothing replaced yet
    ctrl.setTeachingForm({ label: 'good' });
    await ctrl.saveTeaching(); // "Lưu" waits for the answer
    expect(edit(ctrl).saving).toBe(false);

    ctrl.resolveDraftOverwrite(false);
    expect(edit(ctrl).form).toEqual({ label: 'good', topic: 'verify', comment: 'Chữ của tôi', betterPrompt: 'Sửa X, chạy test.' });
    expect(edit(ctrl).ai.overwrite).toBeNull();
    expect(ctrl.getState().announcement).toBe('Nháp cho prompt 1 của Lan đã sẵn sàng.');
  });

  it('"Dùng nháp AI" replaces the typed text', async () => {
    const { ctrl, server } = await started({ drafts: [row(10, { status: 'running', draft: null, sampleCount: null })] });
    ctrl.openTeaching(10);
    await flush();
    ctrl.setTeachingForm({ comment: 'Chữ của tôi', betterPrompt: 'Bản của tôi' });
    server.drafts.set(10, row(10));
    await ctrl.refresh();
    expect(edit(ctrl).ai.overwrite).toEqual({ fields: ['comment', 'betterPrompt'] });
    ctrl.resolveDraftOverwrite(true);
    expect(edit(ctrl).form).toMatchObject({ comment: 'Thiếu cách kiểm tra.', betterPrompt: 'Sửa X, chạy test.' });
  });

  it('typed text the same as the draft is not asked about', async () => {
    const { ctrl, server } = await started({ drafts: [row(10, { status: 'running', draft: null, sampleCount: null })] });
    ctrl.openTeaching(10);
    await flush();
    ctrl.setTeachingForm({ comment: 'Thiếu cách kiểm tra.' });
    server.drafts.set(10, row(10));
    await ctrl.refresh();
    expect(edit(ctrl).ai.overwrite).toBeNull();
  });

  it('a failed draft says why, for the screen reader and in the dialog, and "Viết lại nháp" asks again', async () => {
    const { ctrl, gateway, server } = await started();
    ctrl.openTeaching(10);
    await flush();
    server.drafts.set(10, row(10, { status: 'failed', draft: null, sampleCount: null, error: 'Quá thời gian' }));
    await ctrl.refresh();
    expect(edit(ctrl).ai.row).toMatchObject({ status: 'failed', error: 'Quá thời gian' });
    expect(rowOf(ctrl, 10).exampleDraft).toMatchObject({ status: 'failed', error: 'Quá thời gian' });
    expect(ctrl.getState().announcement).toBe('Viết nháp cho prompt 1 của Lan bị lỗi: quá thời gian.');
    ctrl.regenerateDraft();
    await flush();
    expect(gateway.requestExampleDraft).toHaveBeenCalledTimes(2);
    expect(edit(ctrl).ai.row!.status).toBe('queued');
  });
});

describe('what stays while the page is open', () => {
  it('closing and opening again keeps the typed text and the chosen label; the draft is not poured twice', async () => {
    const { ctrl } = await started({ drafts: [row(10, { seen: true })] });
    ctrl.openTeaching(10);
    await flush();
    ctrl.setTeachingForm({ label: 'good', comment: 'Tôi sửa lại' });
    ctrl.closeTeaching();
    ctrl.openTeaching(10);
    await flush();
    expect(edit(ctrl).form).toMatchObject({ label: 'good', comment: 'Tôi sửa lại' });
    expect(edit(ctrl).ai.overwrite).toBeNull();
  });

  it('a second draft over a kept one asks only about what was changed', async () => {
    const { ctrl, server } = await started({ drafts: [row(10, { seen: true })] });
    ctrl.openTeaching(10);
    await flush();
    ctrl.setTeachingForm({ comment: 'Tôi sửa lại' });
    ctrl.closeTeaching();
    server.drafts.set(10, row(10, { seen: true, createdAt: '2026-11-26T08:05:00.000Z', draft: content({ comment: 'Nháp mới', betterPrompt: 'Bản mới' }) }));
    ctrl.openTeaching(10);
    await flush();
    expect(edit(ctrl).ai.overwrite).toEqual({ fields: ['comment'] });
    ctrl.resolveDraftOverwrite(false);
    expect(edit(ctrl).form).toMatchObject({ comment: 'Tôi sửa lại', betterPrompt: 'Bản mới' }); // the untouched field followed the new draft
  });

  it('a controller made afresh (F5) starts from the draft of the server, label empty', async () => {
    const { ctrl } = await started({ drafts: [row(10, { seen: true })] });
    ctrl.openTeaching(10);
    await flush();
    ctrl.setTeachingForm({ label: 'good', comment: 'Tôi sửa lại' });
    ctrl.closeTeaching();
    const again = await started({ drafts: [row(10, { seen: true })] });
    again.ctrl.openTeaching(10);
    await flush();
    expect(edit(again.ctrl).form).toMatchObject({ label: '', comment: 'Thiếu cách kiểm tra.' });
  });

  it('"Bỏ nháp" deletes it, closes the dialog and forgets what was typed', async () => {
    const { ctrl, gateway } = await started({ drafts: [row(10, { seen: true })] });
    ctrl.openTeaching(10);
    await flush();
    ctrl.setTeachingForm({ comment: 'Tôi sửa lại' });
    ctrl.discardDraft();
    await flush();
    expect(gateway.discardExampleDraft).toHaveBeenCalledWith(5, 10);
    expect(ctrl.getState().teachingEdit).toBeNull();
    expect(rowOf(ctrl, 10).exampleDraft).toBeNull();
    ctrl.openTeaching(10); // no draft any more: a new one is asked for, over an empty form
    await flush();
    expect(edit(ctrl).form.comment).toBe('');
    expect(gateway.requestExampleDraft).toHaveBeenCalledTimes(1);
  });

  it('saving forgets it too: the button then shows the saved example', async () => {
    const { ctrl } = await started({ drafts: [row(10, { seen: true })] });
    ctrl.openTeaching(10);
    await flush();
    ctrl.setTeachingForm({ label: 'good' });
    await ctrl.saveTeaching();
    expect(ctrl.getState().teachingEdit).toBeNull();
    ctrl.openTeaching(10);
    expect(edit(ctrl).exists).toBe(true);
  });
});

describe('the page follows the drafts', () => {
  it('reloads from the oldest prompt whose draft is still being written, so its button changes when it ends', async () => {
    const { ctrl, gateway, server } = await started({ drafts: [row(10, { status: 'running', draft: null, sampleCount: null })] });
    server.drafts.set(10, row(10, { draft: content({ suspicious: true }) }));
    await ctrl.refresh();
    expect(gateway.events).toHaveBeenLastCalledWith(5, 1, 9);
    expect(rowOf(ctrl, 10).exampleDraft).toMatchObject({ status: 'done', suspicious: true });
  });

  it('says aloud when a draft of a prompt of another member ends, asking the server about it', async () => {
    const { ctrl, gateway, server } = await started({ drafts: [row(10, { status: 'running', draft: null, sampleCount: null })] });
    await ctrl.refresh(); // a draft already running is watched, quietly
    expect(ctrl.getState().announcement).toBe('');
    ctrl.select(2);
    await flush();
    server.drafts.set(10, row(10));
    await ctrl.refresh();
    expect(gateway.exampleDraft).toHaveBeenCalledWith(5, 10);
    expect(ctrl.getState().announcement).toBe('Nháp cho prompt 1 của Lan đã sẵn sàng.');
  });

  it('"Nháp tiếp theo" picks the member of the next draft, reveals its prompt and asks the page to focus its button', async () => {
    const { ctrl } = await started({ prompts: { 1: [10], 2: [20, 21] }, drafts: [row(21)], detail: detail({ exampleDrafts: { drafting: 0, unseen: 1, failed: 0, next: { memberId: 2, eventId: 21 } } }) });
    expect(ctrl.getState().selectedId).toBe(1);
    ctrl.goToNextDraft();
    await flush();
    const s = ctrl.getState();
    expect(s.selectedId).toBe(2);
    expect(s.draftFocus).toEqual({ eventId: 21, token: 1 });
    expect(s.timeline!.revealId).toBe(21);
    ctrl.goToNextDraft(); // same member now: no reload needed
    expect(ctrl.getState().draftFocus.token).toBe(2);
  });

  it('"Nháp tiếp theo" does nothing when no finished draft waits', async () => {
    const { ctrl } = await started();
    ctrl.goToNextDraft();
    expect(ctrl.getState().draftFocus.token).toBe(0);
    expect(ctrl.getState().selectedId).toBe(1);
  });
});
