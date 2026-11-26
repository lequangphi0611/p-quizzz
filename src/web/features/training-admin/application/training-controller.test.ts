import { describe, expect, it, vi } from 'vitest';
import type { ExampleDraftContent, ExampleDraftRow, TeachingExampleBody, TeachingExampleRow, TrainingDetail, TrainingEventDetail, TrainingEventRow, TrainingEventsPage, TrainingExportSummary, TrainingMemberRow } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { TrainingAdminGateway } from './training-admin-gateway.js';
import { TrainingController } from './training-controller.js';
import { InMemoryTrainingReadStore, type TrainingReadStore } from './training-read-store.js';

const ZERO_COUNTS: TrainingDetail['flagCounts'] = { auto_accept: 0, auto_compact_repeated: 0, dangerous_command: 0, edited_not_verified: 0, fast_approvals: 0, long_without_verify: 0, possible_secret: 0, repeated_failure: 0, repeated_request: 0, touches_tests: 0 };

const member = (id: number, displayName: string, over: Partial<TrainingMemberRow> = {}): TrainingMemberRow =>
  ({ id, displayName, connection: 'connected', lastSeenAt: 1, promptCount: 1, toolCount: 1, failedCount: 0, stuck: false, stillSending: false, stoppedSending: false, flags: [], clearCount: 0, compactCount: 0, permissionCount: 0, mentorNote: null, markedCount: 0, teachingConsent: true, exampleDrafts: { drafting: 0, unseen: 0, failed: 0 }, ...over });
const detail = (over: Partial<TrainingDetail> = {}): TrainingDetail =>
  ({ id: 5, name: 'Buổi 1', status: 'open', roomCode: '482913', createdAt: 0, stoppedAt: null, endedAt: null, uninstalled: null, allowAutoAccept: false, reportExportedAt: null, unexportedExampleCount: 0, flagCounts: ZERO_COUNTS, aiDraftAvailable: false, exampleDrafts: { drafting: 0, unseen: 0, failed: 0, next: null }, members: [member(1, 'An'), member(2, 'Bình')], ...over });
const ev = (id: number, over: Partial<TrainingEventRow> = {}): TrainingEventRow =>
  ({ id, kind: 'tool', receivedAt: id, claudeSessionId: 's', toolName: 'Bash', toolTarget: 'ls', ok: true, hasOutput: false, hasChange: false, marked: false, teachingExample: null, exampleDraft: null, ...over });
const page = (ids: number[], hasMore = false): TrainingEventsPage => ({ events: ids.map(i => ev(i)), hasMore, flags: [] });

const teachingRow = (eventId: number, body: Partial<TeachingExampleBody> = {}, over: Partial<TeachingExampleRow> = {}): TeachingExampleRow => ({
  eventId, memberId: 1, memberName: 'An', label: 'good', topic: 'other', comment: 'ok', betterPrompt: null, editedPrompt: null, editedContext: null, reviewed: false,
  defaultPrompt: 'prompt gốc', defaultContext: '✓ Bash ls', updatedAt: 1, ...body, ...over,
});

const draftContent = (over: Partial<ExampleDraftContent> = {}): ExampleDraftContent => ({ label: 'needs_work', topic: 'verify', comment: 'Thiếu cách kiểm tra.', betterPrompt: 'Sửa X, chạy test.', suspicious: false, suspiciousReason: '', suspiciousQuote: '', ...over });
const draftRow = (eventId: number, over: Partial<ExampleDraftRow> = {}): ExampleDraftRow => ({ eventId, status: 'done', draft: draftContent(), sampleCount: 2, error: null, seen: false, createdAt: '2026-11-26T08:00:00.000Z', ...over });

const exportSummary = (over: Partial<TrainingExportSummary> = {}): TrainingExportSummary => ({ from: '2026-11-24', to: '2026-11-24', memberCount: 2, eventCount: 12, approxBytes: 4096, tooLarge: false, ...over });

const deferred = <T,>() => { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = () => new Promise<void>(r => setTimeout(r, 0));

function make(over: Partial<TrainingAdminGateway> = {}, initial = detail(), opts: ConstructorParameters<typeof TrainingController>[2] = {}) {
  let hide = false;
  const gateway: TrainingAdminGateway = {
    list: vi.fn(async () => [{ id: 5, name: 'Buổi 1', status: 'ended' as const, createdAt: 0, stoppedAt: 1, endedAt: 2, memberCount: 7 }]),
    create: vi.fn(),
    get: vi.fn(async () => initial),
    stop: vi.fn(async () => detail({ status: 'stopped', roomCode: null, uninstalled: { count: 0, total: 2 } })),
    end: vi.fn(async () => detail({ status: 'ended', roomCode: null, members: [] })),
    removeMember: vi.fn(async () => {}),
    purgeMember: vi.fn(async () => {}),
    events: vi.fn(async () => page([10, 11, 12])),
    eventDetail: vi.fn(async (): Promise<TrainingEventDetail> => ({ output: { head: 'out', tail: null, omittedLines: 0 }, change: { head: '+ x', tail: null, omittedLines: 0 } })),
    mark: vi.fn(async () => {}),
    saveNote: vi.fn(async () => {}),
    reportPreview: vi.fn(async () => '# Báo cáo'),
    exportReport: vi.fn(async () => '# Báo cáo\nđầy đủ'),
    exportSummary: vi.fn(async () => exportSummary()),
    exportData: vi.fn(async () => new Blob(['zip'])),
    saveTeachingExample: vi.fn(async (_t: number, eventId: number, body) => teachingRow(eventId, body)),
    deleteTeachingExample: vi.fn(async () => {}),
    setTeachingReviewed: vi.fn(async () => {}),
    teachingExamples: vi.fn(async () => []),
    exportTeachingExamples: vi.fn(async () => '# Ví dụ'),
    requestExampleDraft: vi.fn(async (_t: number, eventId: number) => draftRow(eventId, { status: 'queued' })),
    exampleDraft: vi.fn(async () => null),
    discardExampleDraft: vi.fn(async () => {}),
    markExampleDraftSeen: vi.fn(async () => {}),
    getJoinHosts: vi.fn(async () => ['192.168.1.5:3000']),
    readHideContent: () => hide,
    writeHideContent: vi.fn((h: boolean) => { hide = h; }),
    ...over,
  };
  return { gateway, ctrl: new TrainingController(gateway, initial, opts) };
}

describe('TrainingController: picking a member', () => {
  it('opens the member from the URL on start, once, and loads their timeline', async () => {
    const { ctrl, gateway } = make({}, detail(), { initialMemberId: 2 });
    expect(ctrl.getState()).toMatchObject({ selectedId: 2, timeline: { phase: 'loading', events: [] } });
    ctrl.start();
    ctrl.start(); // StrictMode runs effects twice
    await flush();
    expect(gateway.events).toHaveBeenCalledTimes(1);
    expect(gateway.events).toHaveBeenCalledWith(5, 2, 0);
    expect(ctrl.getState().timeline).toMatchObject({ memberId: 2, phase: 'ready', events: [{ id: 10 }, { id: 11 }, { id: 12 }], hasMore: false });
  });

  it('ignores a member in the URL who is not in the training', () => {
    const { ctrl } = make({}, detail(), { initialMemberId: 99 });
    expect(ctrl.getState()).toMatchObject({ selectedId: null, timeline: null });
  });

  it('loads nothing until a member is picked (no output either)', async () => {
    const { ctrl, gateway } = make();
    ctrl.start();
    await flush();
    expect(gateway.events).not.toHaveBeenCalled();
    expect(gateway.eventDetail).not.toHaveBeenCalled();
  });

  it('drops a slow answer for a member who is no longer picked', async () => {
    const slow = deferred<TrainingEventsPage>();
    const { ctrl } = make({ events: vi.fn(async (_t, memberId) => (memberId === 1 ? slow.promise : page([20]))) });
    ctrl.select(1);
    ctrl.select(2);
    await flush();
    slow.resolve(page([10]));
    await flush();
    expect(ctrl.getState().timeline).toMatchObject({ memberId: 2, events: [{ id: 20 }] });
  });

  it('shows a failed first load with its message, and retries', async () => {
    let fail = true;
    const { ctrl } = make({ events: vi.fn(async () => { if (fail) throw new ApiError(500, 'Máy chủ lỗi'); return page([10]); }) });
    ctrl.select(1);
    await flush();
    expect(ctrl.getState().timeline).toMatchObject({ phase: 'error', error: 'Máy chủ lỗi' });
    fail = false;
    ctrl.retryTimeline();
    await flush();
    expect(ctrl.getState().timeline).toMatchObject({ phase: 'ready', events: [{ id: 10 }] });
  });

  it('picking none, or another member, closes the panel and forgets the timeline', async () => {
    const { ctrl } = make();
    ctrl.select(1);
    await flush();
    await ctrl.openDetail(10, 'output');
    expect(ctrl.getState().panel).not.toBeNull();
    ctrl.select(null);
    expect(ctrl.getState()).toMatchObject({ selectedId: null, timeline: null, panel: null });
  });
});

describe('TrainingController: paging by `after`', () => {
  it('keeps fetching pages until the server says there is no more', async () => {
    const events = vi.fn(async (_t: number, _m: number, after = 0): Promise<TrainingEventsPage> => (after === 0 ? page([1, 2], true) : after === 2 ? page([3, 4], true) : page([5], false)));
    const { ctrl } = make({ events });
    ctrl.select(1);
    await flush();
    expect(events.mock.calls.map(c => c[2])).toEqual([0, 2, 4]);
    expect(ctrl.getState().timeline).toMatchObject({ events: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }], hasMore: false });
  });

  it('stops at the page cap and offers "Tải thêm", which continues from the last event', async () => {
    const events = vi.fn(async (_t: number, _m: number, after = 0): Promise<TrainingEventsPage> => page([after + 1, after + 2], after < 6));
    const { ctrl } = make({ events }, detail(), { maxPages: 2 });
    ctrl.select(1);
    await flush();
    expect(ctrl.getState().timeline).toMatchObject({ hasMore: true, events: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] });
    await ctrl.loadMore();
    expect(ctrl.getState().timeline).toMatchObject({ hasMore: false, events: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }, { id: 8 }] });
  });

  it('"Tải thêm" neither follows the newest event nor counts the batch as new', async () => {
    const events = vi.fn(async (_t: number, _m: number, after = 0): Promise<TrainingEventsPage> => page([after + 1, after + 2], after < 6));
    const { ctrl } = make({ events }, detail(), { maxPages: 2 });
    ctrl.select(1);
    await flush();
    ctrl.reportFollowing(true); // the newest loaded event is in view, as it is when the button is visible
    const before = ctrl.getState().timeline!;
    await ctrl.loadMore();
    const after = ctrl.getState().timeline!;
    expect(after.events).toHaveLength(8);
    expect(after.followToken).toBe(before.followToken);
    expect(after.newCount).toBe(0);
  });

  it('a failed "Tải thêm" keeps what is shown and says why', async () => {
    let calls = 0;
    const events = vi.fn(async (): Promise<TrainingEventsPage> => { if (++calls === 1) return page([1], true); throw new ApiError(0, 'Không kết nối được tới máy chủ'); });
    const { ctrl } = make({ events }, detail(), { maxPages: 1 });
    ctrl.select(1);
    await flush();
    await ctrl.loadMore();
    expect(ctrl.getState().timeline).toMatchObject({ events: [{ id: 1 }], hasMore: true, loadingMore: false, error: 'Không kết nối được tới máy chủ' });
  });
});

describe('TrainingController: new events', () => {
  async function opened() {
    let latest = [10, 11];
    const events = vi.fn(async (_t: number, _m: number, after = 0): Promise<TrainingEventsPage> => page(latest.filter(i => i > after)));
    const made = make({ events });
    made.ctrl.select(1);
    await flush();
    return { ...made, push: (...ids: number[]) => { latest = [...latest, ...ids]; } };
  }

  it('asks only for events after the last one shown and appends them', async () => {
    const { ctrl, gateway, push } = await opened();
    push(12, 13);
    await ctrl.refresh();
    expect(gateway.events).toHaveBeenLastCalledWith(5, 1, 11);
    expect(ctrl.getState().timeline?.events.map(e => e.id)).toEqual([10, 11, 12, 13]);
  });

  it('while the newest event is in view it follows new events; no chip', async () => {
    const { ctrl, push } = await opened();
    const before = ctrl.getState().timeline!.followToken;
    ctrl.reportFollowing(true);
    push(12);
    await ctrl.refresh();
    expect(ctrl.getState().timeline).toMatchObject({ newCount: 0, followToken: before + 1 });
  });

  it('looking elsewhere it does not move: it counts them for the "N sự kiện mới" chip', async () => {
    const { ctrl, push } = await opened();
    const before = ctrl.getState().timeline!.followToken;
    ctrl.reportFollowing(false);
    push(12, 13);
    await ctrl.refresh();
    push(14);
    await ctrl.refresh();
    expect(ctrl.getState().timeline).toMatchObject({ newCount: 3, followToken: before });
  });

  it('seeing the newest event again clears the chip; the chip jumps to the newest event', async () => {
    const { ctrl, push } = await opened();
    ctrl.reportFollowing(false);
    push(12);
    await ctrl.refresh();
    const token = ctrl.getState().timeline!.followToken;
    ctrl.jumpToLatest();
    expect(ctrl.getState().timeline).toMatchObject({ newCount: 0, followToken: token + 1 });

    ctrl.reportFollowing(false);
    push(13);
    await ctrl.refresh();
    expect(ctrl.getState().timeline?.newCount).toBe(1);
    ctrl.reportFollowing(true);
    expect(ctrl.getState().timeline?.newCount).toBe(0);
  });

  it('a member picked later starts at the newest event, whatever the scroll position was before', async () => {
    const { ctrl, push } = await opened();
    ctrl.reportFollowing(false);
    ctrl.select(2);
    await flush();
    const token = ctrl.getState().timeline!.followToken;
    push(12);
    await ctrl.refresh();
    expect(ctrl.getState().timeline).toMatchObject({ newCount: 0, followToken: token + 1 });
  });
});

describe('TrainingController: reloading', () => {
  it('signals that arrive while a reload runs collapse into one more run', async () => {
    const first = deferred<TrainingDetail>();
    const get = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(detail());
    const { ctrl } = make({ get });
    const a = ctrl.refresh();
    void ctrl.refresh();
    void ctrl.refresh();
    expect(get).toHaveBeenCalledTimes(1);
    first.resolve(detail());
    await a;
    await flush();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('flags the page as offline when a reload fails and clears the flag on the next success', async () => {
    let up = false;
    const { ctrl } = make({ get: vi.fn(async () => { if (!up) throw new ApiError(0, 'Không kết nối được tới máy chủ'); return detail(); }) });
    await ctrl.refresh();
    expect(ctrl.getState().offline).toBe(true);
    up = true;
    await ctrl.refresh();
    expect(ctrl.getState().offline).toBe(false);
  });

  it('a 404 or 401 is not "offline"', async () => {
    const { ctrl } = make({ get: vi.fn(async () => { throw new ApiError(401, 'Cần đăng nhập'); }) });
    await ctrl.refresh();
    expect(ctrl.getState().offline).toBe(false);
  });

  it('updates the table and announces who started sending, for a screen reader', async () => {
    const { ctrl } = make({ get: vi.fn(async () => detail({ members: [member(1, 'An'), member(2, 'Bình'), member(3, 'Chi', { connection: 'waiting' })] })) }, detail({ members: [member(1, 'An'), member(2, 'Bình', { connection: 'waiting' })] }));
    await ctrl.refresh();
    expect(ctrl.getState().detail.members).toHaveLength(3);
    expect(ctrl.getState().announcement).toBe('Bình đã nhận tín hiệu. Chi đã vào buổi');
  });

  it('drops a member who was removed elsewhere, with their timeline and panel', async () => {
    const { ctrl, gateway } = make();
    ctrl.select(1);
    await flush();
    (gateway.get as ReturnType<typeof vi.fn>).mockResolvedValue(detail({ members: [member(2, 'Bình')] }));
    await ctrl.refresh();
    expect(ctrl.getState()).toMatchObject({ selectedId: null, timeline: null, panel: null });
  });

  it('a reload that began before a stop finished never brings the old status back', async () => {
    const late = deferred<TrainingDetail>();
    const { ctrl, gateway } = make();
    (gateway.get as ReturnType<typeof vi.fn>).mockReturnValueOnce(late.promise);
    const reloading = ctrl.refresh();
    ctrl.askStop();
    await ctrl.confirm();
    expect(ctrl.getState().detail.status).toBe('stopped');
    late.resolve(detail()); // older: still "open"
    await reloading;
    expect(ctrl.getState().detail.status).toBe('stopped');
  });
});

describe('TrainingController: output and change panel', () => {
  async function withEvents() {
    const events: TrainingEventRow[] = [ev(10, { hasOutput: true }), ev(11), ev(12, { hasChange: true }), ev(13, { hasOutput: true, hasChange: true })];
    const made = make({ events: vi.fn(async () => ({ events, hasMore: false, flags: [] })) });
    made.ctrl.select(1);
    await flush();
    return made;
  }

  it('fetches the content only when asked, and shows it', async () => {
    const { ctrl, gateway } = await withEvents();
    expect(gateway.eventDetail).not.toHaveBeenCalled();
    const p = ctrl.openDetail(10, 'output');
    expect(ctrl.getState().panel).toMatchObject({ eventId: 10, kind: 'output', phase: 'loading', clip: null });
    await p;
    expect(gateway.eventDetail).toHaveBeenCalledWith(5, 10);
    expect(ctrl.getState().panel).toMatchObject({ phase: 'ready', clip: { head: 'out' } });
  });

  it('opens the change of an event when asked for the change', async () => {
    const { ctrl } = await withEvents();
    await ctrl.openDetail(12, 'change');
    expect(ctrl.getState().panel).toMatchObject({ kind: 'change', clip: { head: '+ x' } });
  });

  it('shows an error with the message and retries', async () => {
    let fail = true;
    const { ctrl } = await withEvents();
    (ctrl as unknown as { gateway: TrainingAdminGateway }).gateway.eventDetail = vi.fn(async () => { if (fail) throw new ApiError(404, 'Không tìm thấy sự kiện'); return { output: { head: 'ok', tail: null, omittedLines: 0 }, change: null }; });
    await ctrl.openDetail(10, 'output');
    expect(ctrl.getState().panel).toMatchObject({ phase: 'error', error: 'Không tìm thấy sự kiện' });
    fail = false;
    ctrl.retryPanel();
    await flush();
    expect(ctrl.getState().panel).toMatchObject({ phase: 'ready', clip: { head: 'ok' } });
  });

  it('drops the answer of a command the mentor already left', async () => {
    const slow = deferred<TrainingEventDetail>();
    const { ctrl, gateway } = await withEvents();
    (gateway.eventDetail as ReturnType<typeof vi.fn>).mockImplementation(async (_t: number, id: number) => (id === 10 ? slow.promise : { output: { head: 'second', tail: null, omittedLines: 0 }, change: null }));
    const first = ctrl.openDetail(10, 'output');
    await ctrl.openDetail(13, 'output');
    slow.resolve({ output: { head: 'first', tail: null, omittedLines: 0 }, change: null });
    await first;
    expect(ctrl.getState().panel).toMatchObject({ eventId: 13, clip: { head: 'second' } });
  });

  it('closing while it loads leaves no panel behind', async () => {
    const slow = deferred<TrainingEventDetail>();
    const { ctrl, gateway } = await withEvents();
    (gateway.eventDetail as ReturnType<typeof vi.fn>).mockReturnValue(slow.promise);
    const opening = ctrl.openDetail(10, 'output');
    ctrl.closePanel();
    slow.resolve({ output: null, change: null });
    await opening;
    expect(ctrl.getState().panel).toBeNull();
  });

  it('J / K step to the next / previous command that has something to open, keeping the kind when possible', async () => {
    const { ctrl } = await withEvents();
    await ctrl.openDetail(10, 'output');
    ctrl.step(1); // 11 has nothing: goes to 12, which only has a change
    await flush();
    expect(ctrl.getState().panel).toMatchObject({ eventId: 12, kind: 'change' });
    ctrl.step(1); // 13 has both: the kind stays "change"
    await flush();
    expect(ctrl.getState().panel).toMatchObject({ eventId: 13, kind: 'change' });
    ctrl.step(1); // end: stays
    await flush();
    expect(ctrl.getState().panel?.eventId).toBe(13);
    ctrl.step(-1);
    ctrl.step(-1);
    await flush();
    expect(ctrl.getState().panel?.eventId).toBe(10);
    ctrl.step(-1);
    await flush();
    expect(ctrl.getState().panel?.eventId).toBe(10);
  });
});

describe('TrainingController: hiding content', () => {
  it('reads the remembered choice, saves a change and closes the panel when hiding', async () => {
    const { ctrl, gateway } = make({ readHideContent: () => true });
    expect(ctrl.getState().hidden).toBe(true);
    ctrl.select(1);
    await flush();
    ctrl.setHidden(false);
    await ctrl.openDetail(10, 'output');
    ctrl.toggleHidden();
    expect(ctrl.getState()).toMatchObject({ hidden: true, panel: null });
    expect(gateway.writeHideContent).toHaveBeenLastCalledWith(true);
    ctrl.toggleHidden();
    expect(gateway.writeHideContent).toHaveBeenLastCalledWith(false);
  });
});

describe('TrainingController: stop, end, remove', () => {
  it('asks first; nothing is sent until the mentor confirms', () => {
    const { ctrl, gateway } = make();
    ctrl.askStop();
    expect(ctrl.getState().confirm).toEqual({ kind: 'stop' });
    ctrl.cancelConfirm();
    expect(ctrl.getState().confirm).toBeNull();
    expect(gateway.stop).not.toHaveBeenCalled();
  });

  it('stop moves the page to "stopped" with the answer, announced for a screen reader', async () => {
    const { ctrl, gateway } = make();
    ctrl.askStop();
    await ctrl.confirm();
    expect(gateway.stop).toHaveBeenCalledWith(5);
    expect(ctrl.getState()).toMatchObject({ confirm: null, working: false, detail: { status: 'stopped', roomCode: null, uninstalled: { count: 0, total: 2 } }, announcement: 'Đã dừng thu' });
  });

  it('a double click runs the action once', async () => {
    const slow = deferred<TrainingDetail>();
    const { ctrl, gateway } = make({ stop: vi.fn(() => slow.promise) });
    ctrl.askStop();
    const a = ctrl.confirm();
    void ctrl.confirm();
    expect(ctrl.getState().working).toBe(true);
    ctrl.cancelConfirm(); // locked while it runs
    expect(ctrl.getState().confirm).not.toBeNull();
    slow.resolve(detail({ status: 'stopped', roomCode: null }));
    await a;
    expect(gateway.stop).toHaveBeenCalledTimes(1);
  });

  it('end is only offered once stopped; stopping is not offered twice', () => {
    const { ctrl } = make();
    ctrl.askEnd();
    expect(ctrl.getState().confirm).toBeNull();
    const stopped = make({}, detail({ status: 'stopped', roomCode: null }));
    stopped.ctrl.askStop();
    expect(stopped.ctrl.getState().confirm).toBeNull();
    stopped.ctrl.askEnd();
    expect(stopped.ctrl.getState().confirm).toEqual({ kind: 'end' });
  });

  it('end clears the timeline and the panel, and learns the member count from the list', async () => {
    const { ctrl } = make({}, detail({ status: 'stopped', roomCode: null }));
    ctrl.select(1);
    await flush();
    await ctrl.openDetail(10, 'output');
    ctrl.askEnd();
    await ctrl.confirm();
    await flush();
    expect(ctrl.getState()).toMatchObject({ detail: { status: 'ended', members: [] }, selectedId: null, timeline: null, panel: null, endedMemberCount: 7 });
  });

  it('an ended training opened later still knows its member count', async () => {
    const { ctrl } = make({}, detail({ status: 'ended', roomCode: null, members: [] }));
    ctrl.start();
    await flush();
    expect(ctrl.getState().endedMemberCount).toBe(7);
  });

  it('shows the server message when the action fails, keeps the dialog and looks again', async () => {
    const { ctrl, gateway } = make({ stop: vi.fn(async () => { throw new ApiError(409, 'Buổi này không còn mở'); }) });
    ctrl.askStop();
    await ctrl.confirm();
    expect(ctrl.getState()).toMatchObject({ working: false, actionError: 'Buổi này không còn mở', confirm: { kind: 'stop' } });
    await flush();
    expect(gateway.get).toHaveBeenCalled();
  });

  it('closes a dialog that no longer makes sense after a reload (someone else stopped it)', async () => {
    const { ctrl, gateway } = make();
    ctrl.askStop();
    (gateway.get as ReturnType<typeof vi.fn>).mockResolvedValue(detail({ status: 'stopped', roomCode: null }));
    await ctrl.refresh();
    expect(ctrl.getState().confirm).toBeNull();
  });

  it('removing a member asks by name, then reloads; removing the picked member clears the timeline', async () => {
    const { ctrl, gateway } = make();
    ctrl.select(2);
    await flush();
    ctrl.askRemove(2);
    expect(ctrl.getState().confirm).toEqual({ kind: 'remove', memberId: 2, name: 'Bình' });
    (gateway.get as ReturnType<typeof vi.fn>).mockResolvedValue(detail({ members: [member(1, 'An')] }));
    await ctrl.confirm();
    expect(gateway.removeMember).toHaveBeenCalledWith(5, 2);
    expect(ctrl.getState()).toMatchObject({ confirm: null, selectedId: null, timeline: null, detail: { members: [{ id: 1 }] } });
  });

  it('"Duyệt xoá" asks by name for a member who stopped sending, calls purge (not remove) and reloads', async () => {
    const stopped = detail({ members: [member(1, 'An'), member(2, 'Bình', { connection: 'stopped_sending', stoppedSending: true })] });
    const { ctrl, gateway } = make({}, stopped);
    ctrl.select(2);
    await flush();
    ctrl.askPurge(2);
    expect(ctrl.getState().confirm).toEqual({ kind: 'purge', memberId: 2, name: 'Bình' });
    (gateway.get as ReturnType<typeof vi.fn>).mockResolvedValue(detail({ members: [member(1, 'An')] }));
    await ctrl.confirm();
    expect(gateway.purgeMember).toHaveBeenCalledWith(5, 2);
    expect(gateway.removeMember).not.toHaveBeenCalled();
    expect(ctrl.getState()).toMatchObject({ confirm: null, selectedId: null, detail: { members: [{ id: 1 }] } });
  });

  it('"Duyệt xoá" is only for a member who stopped sending, and not once ended', () => {
    const { ctrl } = make({}, detail({ members: [member(1, 'An'), member(2, 'Bình', { stoppedSending: true })] }));
    ctrl.askPurge(1);
    expect(ctrl.getState().confirm).toBeNull();
    ctrl.askPurge(2);
    expect(ctrl.getState().confirm).toMatchObject({ kind: 'purge' });
    const ended = make({}, detail({ status: 'ended', roomCode: null, members: [member(2, 'Bình', { stoppedSending: true })] }));
    ended.ctrl.askPurge(2);
    expect(ended.ctrl.getState().confirm).toBeNull();
  });

  it('a purge the server refuses (409) shows the error and looks again', async () => {
    const { ctrl, gateway } = make({ purgeMember: vi.fn(async () => { throw new Error('Chỉ xoá được dữ liệu của người đã dừng gửi'); }) }, detail({ members: [member(2, 'Bình', { stoppedSending: true })] }));
    ctrl.askPurge(2);
    await ctrl.confirm();
    expect(ctrl.getState().confirm).toMatchObject({ kind: 'purge' });
    expect(ctrl.getState().actionError).not.toBe('');
    expect(gateway.get).toHaveBeenCalled();
  });

  it('cannot remove someone who is not in the training, nor anyone once ended', () => {
    const { ctrl } = make();
    ctrl.askRemove(99);
    expect(ctrl.getState().confirm).toBeNull();
    const ended = make({}, detail({ status: 'ended', roomCode: null, members: [] }));
    ended.ctrl.askRemove(1);
    expect(ended.ctrl.getState().confirm).toBeNull();
  });
});

describe('TrainingController: flags and rows that change', () => {
  const flagged: TrainingEventsPage = {
    events: [ev(10), ev(11, { kind: 'permission', toolName: 'Bash', decision: 'pending' }), ev(12), ev(13)],
    hasMore: false,
    flags: [{ code: 'touches_tests', eventIds: [10, 13] }, { code: 'dangerous_command', eventIds: [999] }],
  };

  it('keeps the flags of the whole timeline from the server', async () => {
    const { ctrl } = make({ events: vi.fn(async () => flagged) });
    ctrl.select(1);
    await flush();
    expect(ctrl.getState().timeline?.flags).toEqual(flagged.flags);
  });

  it('a flag chip jumps to its events one after another, wrapping round, and skips events that are not loaded', async () => {
    const { ctrl } = make({ events: vi.fn(async () => flagged) });
    ctrl.select(1);
    await flush();
    const focus = () => ctrl.getState().timeline?.focusId;
    ctrl.jumpToFlag('touches_tests');
    expect(focus()).toBe(10);
    ctrl.jumpToFlag('touches_tests');
    expect(focus()).toBe(13);
    ctrl.jumpToFlag('touches_tests');
    expect(focus()).toBe(10);
    const token = ctrl.getState().timeline!.focusToken;
    ctrl.jumpToFlag('dangerous_command'); // its only event is not on this page
    expect(ctrl.getState().timeline?.focusToken).toBe(token);
    ctrl.jumpToFlag('possible_secret'); // not a flag of this member
    expect(ctrl.getState().timeline?.focusToken).toBe(token);
  });

  it('does not jump while the content is hidden', async () => {
    const { ctrl } = make({ events: vi.fn(async () => flagged) });
    ctrl.select(1);
    await flush();
    ctrl.setHidden(true);
    ctrl.jumpToFlag('touches_tests');
    expect(ctrl.getState().timeline?.focusId).toBeNull();
  });

  it('a request that was waiting gets its answer on the next refresh, from that request on, without duplicating rows', async () => {
    const events = vi.fn()
      .mockResolvedValueOnce({ events: [ev(10), ev(11, { kind: 'permission', toolName: 'Bash', decision: 'pending' })], hasMore: false, flags: [] })
      .mockResolvedValueOnce({ events: [ev(11, { kind: 'permission', toolName: 'Bash', decision: 'allowed', decisionMs: 900 }), ev(12)], hasMore: false, flags: [] });
    const { ctrl } = make({ events });
    ctrl.select(1);
    await flush();
    await ctrl.refresh();
    expect(events).toHaveBeenLastCalledWith(5, 1, 10); // from just before the waiting request
    const rows = ctrl.getState().timeline!.events;
    expect(rows.map(e => e.id)).toEqual([10, 11, 12]);
    expect(rows[1]).toMatchObject({ decision: 'allowed', decisionMs: 900 });
  });
});

describe('TrainingController: marks, notes and the report (S40)', () => {
  const picked = async (over: Partial<TrainingAdminGateway> = {}, initial = detail(), opts: ConstructorParameters<typeof TrainingController>[2] = {}) => {
    const m = make(over, initial, { initialMemberId: 1, ...opts });
    m.ctrl.start();
    await flush();
    return m;
  };
  const marked = (ctrl: TrainingController) => ctrl.getState().timeline!.events.map(e => e.marked);

  it('marks a row at once, tells the server, and unmarks it the same way', async () => {
    const mark = deferred<void>();
    const { ctrl, gateway } = await picked({ mark: vi.fn(() => mark.promise) });
    const done = ctrl.toggleMark(11);
    expect(marked(ctrl)).toEqual([false, true, false]); // before the server answered
    mark.resolve();
    await done;
    expect(gateway.mark).toHaveBeenCalledWith(5, 11, true);
    await ctrl.toggleMark(11);
    expect(gateway.mark).toHaveBeenLastCalledWith(5, 11, false);
    expect(marked(ctrl)).toEqual([false, false, false]);
  });

  it('puts the row back and says why when the server refuses', async () => {
    const { ctrl } = await picked({ mark: vi.fn(async () => { throw new ApiError(409, 'Buổi training đã kết thúc'); }) });
    await ctrl.toggleMark(10);
    expect(marked(ctrl)).toEqual([false, false, false]);
    expect(ctrl.getState().markError).toBe('Buổi training đã kết thúc');
  });

  it('clears the error once a mark works', async () => {
    let fail = true;
    const { ctrl } = await picked({ mark: vi.fn(async () => { if (fail) throw new ApiError(500, 'Lỗi 500'); }) });
    await ctrl.toggleMark(10);
    expect(ctrl.getState().markError).not.toBe('');
    fail = false;
    await ctrl.toggleMark(10);
    expect(ctrl.getState().markError).toBe('');
  });

  it('ignores an event that is not on screen', async () => {
    const { ctrl, gateway } = await picked();
    await ctrl.toggleMark(999);
    expect(gateway.mark).not.toHaveBeenCalled();
  });

  it('saves a note, shows it on the member row at once, and answers null', async () => {
    // The reload that follows never answers here, so what the row shows is what the controller put there.
    const { ctrl, gateway } = await picked({ get: vi.fn(() => new Promise<TrainingDetail>(() => {})) });
    expect(await ctrl.saveNote(1, '  Nhắc chạy test  ')).toBeNull();
    expect(gateway.saveNote).toHaveBeenCalledWith(5, 1, '  Nhắc chạy test  ');
    expect(ctrl.getState().detail.members.find(m => m.id === 1)!.mentorNote).toBe('Nhắc chạy test');
    expect(await ctrl.saveNote(1, '   ')).toBeNull();
    expect(ctrl.getState().detail.members.find(m => m.id === 1)!.mentorNote).toBeNull();
  });

  it('answers with the reason when the note cannot be saved, and leaves the row alone', async () => {
    const { ctrl } = await picked({ saveNote: vi.fn(async () => { throw new ApiError(400, 'Ghi chú tối đa 2000 ký tự'); }) });
    expect(await ctrl.saveNote(1, 'x')).toBe('Ghi chú tối đa 2000 ký tự');
    expect(ctrl.getState().detail.members.find(m => m.id === 1)!.mentorNote).toBeNull();
  });

  it('opens the report with a preview that is not an export', async () => {
    const { ctrl, gateway } = make();
    await ctrl.openReport();
    expect(ctrl.getState().report).toEqual({ phase: 'ready', text: '# Báo cáo', error: '', saving: false, saved: false });
    expect(gateway.reportPreview).toHaveBeenCalledWith(5);
    expect(gateway.exportReport).not.toHaveBeenCalled();
  });

  it('shows why the preview failed and can be retried', async () => {
    const { ctrl } = make({ reportPreview: vi.fn().mockRejectedValueOnce(new ApiError(500, 'Lỗi 500')).mockResolvedValue('# ok') });
    await ctrl.openReport();
    expect(ctrl.getState().report).toMatchObject({ phase: 'error', error: 'Lỗi 500' });
    await ctrl.openReport();
    expect(ctrl.getState().report).toMatchObject({ phase: 'ready', text: '# ok' });
  });

  it('downloads the file under a safe name, once per press, and reloads to learn it was exported', async () => {
    const saveFile = vi.fn();
    const exported = deferred<string>();
    const { ctrl, gateway } = make({ exportReport: vi.fn(() => exported.promise) }, detail(), { saveFile });
    await ctrl.openReport();
    const first = ctrl.downloadReport();
    void ctrl.downloadReport(); // a second press while it runs
    expect(ctrl.getState().report!.saving).toBe(true);
    exported.resolve('# nội dung file');
    await first;
    expect(gateway.exportReport).toHaveBeenCalledTimes(1);
    expect(saveFile).toHaveBeenCalledExactlyOnceWith('bao-cao-buoi-1.md', '# nội dung file');
    expect(ctrl.getState().report).toMatchObject({ saving: false, saved: true });
    await flush();
    expect(gateway.get).toHaveBeenCalled();
  });

  it('keeps the dialog open with the reason when the download fails', async () => {
    const saveFile = vi.fn();
    const { ctrl } = make({ exportReport: vi.fn(async () => { throw new ApiError(0, 'Không kết nối được tới máy chủ'); }) }, detail(), { saveFile });
    await ctrl.openReport();
    await ctrl.downloadReport();
    expect(saveFile).not.toHaveBeenCalled();
    expect(ctrl.getState().report).toMatchObject({ phase: 'ready', saving: false, saved: false, error: 'Không kết nối được tới máy chủ' });
  });

  it('drops a preview that comes back after the dialog was closed', async () => {
    const late = deferred<string>();
    const { ctrl } = make({ reportPreview: vi.fn(() => late.promise) });
    const opening = ctrl.openReport();
    ctrl.closeReport();
    late.resolve('# muộn');
    await opening;
    expect(ctrl.getState().report).toBeNull();
  });

  it('backing out of "Kết thúc" to export closes the prompt and opens the report', async () => {
    const { ctrl } = make({}, detail({ status: 'stopped', roomCode: null, uninstalled: { count: 0, total: 2 } }));
    ctrl.askEnd();
    expect(ctrl.getState().confirm).toEqual({ kind: 'end' });
    ctrl.exportBeforeEnding();
    expect(ctrl.getState().confirm).toBeNull();
    await flush();
    expect(ctrl.getState().report).toMatchObject({ phase: 'ready' });
  });

  it('opens no report, and closes an open one, once the training has ended', async () => {
    const { ctrl } = make({ get: vi.fn(async () => detail({ status: 'ended', roomCode: null, members: [] })) });
    await ctrl.openReport();
    expect(ctrl.getState().report).not.toBeNull();
    await ctrl.refresh();
    expect(ctrl.getState().report).toBeNull();
    await ctrl.openReport();
    expect(ctrl.getState().report).toBeNull();
  });
});

describe('TrainingController: the popup with the commands of one prompt', () => {
  const twoTurns = (): TrainingEventsPage => ({
    events: [ev(1, { kind: 'prompt', prompt: 'một', toolName: undefined, toolTarget: undefined, ok: undefined }), ev(2, { hasOutput: true }), ev(3, { ok: false, hasOutput: true }),
      ev(4, { kind: 'prompt', prompt: 'hai', toolName: undefined, toolTarget: undefined, ok: undefined }), ev(5, { hasOutput: true })],
    hasMore: false, flags: [{ code: 'repeated_failure', eventIds: [3] }, { code: 'repeated_request', eventIds: [4] }],
  });
  const picked = async () => {
    const m = make({ events: vi.fn(async () => twoTurns()) }, detail(), { initialMemberId: 1 });
    m.ctrl.start();
    await flush();
    return m.ctrl;
  };

  it('opens and closes the popup of a prompt; closing it also closes the output panel', async () => {
    const c = await picked();
    c.openTurn('t1');
    expect(c.getState().turnKey).toBe('t1');
    await c.openDetail(2, 'output');
    expect(c.getState().panel).not.toBeNull();
    c.closeTurn();
    expect(c.getState()).toMatchObject({ turnKey: null, panel: null });
  });

  it('a flag chip opens the popup of the prompt that holds the command it jumps to', async () => {
    const c = await picked();
    c.jumpToFlag('repeated_failure');
    expect(c.getState()).toMatchObject({ turnKey: 't1' });
    expect(c.getState().timeline!.focusId).toBe(3);
  });

  it('a flag on a prompt itself highlights it in the list and opens no popup', async () => {
    const c = await picked();
    c.jumpToFlag('repeated_request');
    expect(c.getState().turnKey).toBeNull();
    expect(c.getState().timeline!.focusId).toBe(4);
  });

  it('J / K to a command of another prompt moves the popup there', async () => {
    const c = await picked();
    c.openTurn('t1');
    await c.openDetail(3, 'output');
    c.step(1);
    expect(c.getState().turnKey).toBe('t4');
    expect(c.getState().panel?.eventId).toBe(5);
  });

  it('is closed by picking another member, by hiding the content, and cannot open once hidden', async () => {
    const c = await picked();
    c.openTurn('t1');
    c.select(2);
    expect(c.getState().turnKey).toBeNull();
    c.openTurn('t1');
    expect(c.getState().turnKey).toBe('t1');
    c.setHidden(true);
    expect(c.getState().turnKey).toBeNull();
    c.openTurn('t1');
    expect(c.getState().turnKey).toBeNull();
  });
});

describe('TrainingController: exporting the raw data (S41)', () => {
  it('opens on "Hôm nay" and the whole class, counts at once and asks the server for nothing but the defaults', async () => {
    const { ctrl, gateway } = make();
    ctrl.openDataExport();
    expect(ctrl.getState().dataExport).toMatchObject({ mode: 'today', memberIds: null, phase: 'loading', summary: null });
    await flush();
    expect(gateway.exportSummary).toHaveBeenCalledExactlyOnceWith(5, { memberIds: null });
    expect(ctrl.getState().dataExport).toMatchObject({ phase: 'ready', summary: { eventCount: 12 }, error: '' });
  });

  it('leaving "Hôm nay" starts from the day the server counted as today; a range starts as that one day', async () => {
    const { ctrl, gateway } = make();
    ctrl.openDataExport();
    await flush();
    ctrl.setDataExportMode('range');
    expect(ctrl.getState().dataExport).toMatchObject({ mode: 'range', from: '2026-11-24', to: '2026-11-24' });
    await flush();
    expect(gateway.exportSummary).toHaveBeenLastCalledWith(5, { from: '2026-11-24', to: '2026-11-24', memberIds: null });
    ctrl.setDataExportMode('today');
    await flush();
    expect(gateway.exportSummary).toHaveBeenLastCalledWith(5, { memberIds: null });
  });

  it('moving the start past the end moves the end with it; an end before the start is refused here, without asking the server', async () => {
    const { ctrl, gateway } = make();
    ctrl.openDataExport();
    await flush();
    ctrl.setDataExportMode('range');
    ctrl.setDataExportTo('2026-11-26');
    ctrl.setDataExportFrom('2026-11-27');
    expect(ctrl.getState().dataExport).toMatchObject({ from: '2026-11-27', to: '2026-11-27' });
    await flush();
    const calls = vi.mocked(gateway.exportSummary).mock.calls.length;
    ctrl.setDataExportTo('2026-11-20');
    expect(ctrl.getState().dataExport).toMatchObject({ phase: 'ready', summary: null, error: 'Ngày kết thúc phải sau hoặc cùng ngày bắt đầu' });
    await flush();
    expect(gateway.exportSummary).toHaveBeenCalledTimes(calls);
  });

  it('"Chọn bạn" starts with everyone ticked; unticking everyone is refused here; "Cả lớp" goes back', async () => {
    const { ctrl, gateway } = make();
    ctrl.openDataExport();
    await flush();
    ctrl.setDataExportAllMembers(false);
    expect(ctrl.getState().dataExport!.memberIds).toEqual([1, 2]);
    await flush();
    expect(gateway.exportSummary).toHaveBeenLastCalledWith(5, { memberIds: [1, 2] });
    ctrl.toggleDataExportMember(1);
    ctrl.toggleDataExportMember(2);
    expect(ctrl.getState().dataExport).toMatchObject({ memberIds: [], summary: null, error: 'Chọn ít nhất một bạn' });
    ctrl.toggleDataExportMember(2);
    await flush();
    expect(gateway.exportSummary).toHaveBeenLastCalledWith(5, { memberIds: [2] });
    ctrl.setDataExportAllMembers(true);
    await flush();
    expect(ctrl.getState().dataExport!.memberIds).toBeNull();
    ctrl.toggleDataExportMember(1); // ticking only means something in "Chọn bạn"
    expect(ctrl.getState().dataExport!.memberIds).toBeNull();
  });

  it('drops a count that comes back after the choice changed', async () => {
    const slow = deferred<TrainingExportSummary>();
    const fast = deferred<TrainingExportSummary>();
    const summaries = vi.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    const { ctrl } = make({ exportSummary: summaries });
    ctrl.openDataExport();
    ctrl.setDataExportAllMembers(false);
    fast.resolve(exportSummary({ eventCount: 3 }));
    await flush();
    slow.resolve(exportSummary({ eventCount: 99 }));
    await flush();
    expect(ctrl.getState().dataExport!.summary!.eventCount).toBe(3);
  });

  it('shows why counting failed and counts again on "Thử lại"', async () => {
    const { ctrl } = make({ exportSummary: vi.fn().mockRejectedValueOnce(new ApiError(0, 'Không kết nối được tới máy chủ')).mockResolvedValue(exportSummary({ eventCount: 5 })) });
    ctrl.openDataExport();
    await flush();
    expect(ctrl.getState().dataExport).toMatchObject({ phase: 'error', error: 'Không kết nối được tới máy chủ', summary: null });
    ctrl.retryDataExport();
    await flush();
    expect(ctrl.getState().dataExport).toMatchObject({ phase: 'ready', error: '', summary: { eventCount: 5 } });
  });

  it('downloads the zip once per press, under a safe name, for the days the server counted, and says so', async () => {
    const saveBlob = vi.fn();
    const zip = deferred<Blob>();
    const { ctrl, gateway } = make({ exportData: vi.fn(() => zip.promise), exportSummary: vi.fn(async () => exportSummary({ from: '2026-11-22', to: '2026-11-24' })) }, detail(), { saveBlob });
    ctrl.openDataExport();
    await flush();
    const first = ctrl.downloadDataExport();
    void ctrl.downloadDataExport(); // a second press while it runs
    expect(ctrl.getState().dataExport!.saving).toBe(true);
    const blob = new Blob(['zip']);
    zip.resolve(blob);
    await first;
    expect(gateway.exportData).toHaveBeenCalledExactlyOnceWith(5, { from: '2026-11-22', to: '2026-11-24', memberIds: null });
    expect(saveBlob).toHaveBeenCalledExactlyOnceWith('du-lieu-buoi-1-2026-11-22_2026-11-24.zip', blob);
    expect(ctrl.getState().dataExport).toMatchObject({ saving: false, saved: true });
    expect(gateway.exportReport).not.toHaveBeenCalled(); // not the report: nothing is recorded as exported
  });

  it('changing the choice after a download clears "đã tải"', async () => {
    const { ctrl } = make({}, detail(), { saveBlob: vi.fn() });
    ctrl.openDataExport();
    await flush();
    await ctrl.downloadDataExport();
    expect(ctrl.getState().dataExport!.saved).toBe(true);
    ctrl.setDataExportAllMembers(false);
    expect(ctrl.getState().dataExport!.saved).toBe(false);
  });

  it('keeps the dialog and the choice when the download fails, and allows another try', async () => {
    const saveBlob = vi.fn();
    const { ctrl, gateway } = make({ exportData: vi.fn().mockRejectedValueOnce(new ApiError(404, 'Không có dữ liệu trong khoảng này')).mockResolvedValue(new Blob(['zip'])) }, detail(), { saveBlob });
    ctrl.openDataExport();
    await flush();
    await ctrl.downloadDataExport();
    expect(saveBlob).not.toHaveBeenCalled();
    expect(ctrl.getState().dataExport).toMatchObject({ phase: 'ready', saving: false, saved: false, error: '', saveError: 'Không có dữ liệu trong khoảng này' });
    await ctrl.downloadDataExport();
    expect(gateway.exportData).toHaveBeenCalledTimes(2);
    expect(saveBlob).toHaveBeenCalledTimes(1);
    expect(ctrl.getState().dataExport).toMatchObject({ saved: true, saveError: '' });
  });

  it('will not download what the server said is empty or too large, or while counting', async () => {
    const { ctrl, gateway } = make({ exportSummary: vi.fn().mockResolvedValueOnce(exportSummary({ eventCount: 0 })).mockResolvedValueOnce(exportSummary({ tooLarge: true, approxBytes: 300 * 1024 * 1024 })) }, detail(), { saveBlob: vi.fn() });
    ctrl.openDataExport();
    await ctrl.downloadDataExport(); // still counting
    await flush();
    await ctrl.downloadDataExport(); // nothing in it
    ctrl.setDataExportAllMembers(false);
    await flush();
    await ctrl.downloadDataExport(); // too large
    expect(gateway.exportData).not.toHaveBeenCalled();
  });

  it('drops a download that finishes after the dialog was closed', async () => {
    const saveBlob = vi.fn();
    const zip = deferred<Blob>();
    const { ctrl } = make({ exportData: vi.fn(() => zip.promise) }, detail(), { saveBlob });
    ctrl.openDataExport();
    await flush();
    const downloading = ctrl.downloadDataExport();
    ctrl.closeDataExport();
    zip.resolve(new Blob(['zip']));
    await downloading;
    expect(saveBlob).not.toHaveBeenCalled();
    expect(ctrl.getState().dataExport).toBeNull();
  });

  it('the report dialog and this one replace each other, and neither survives the end of the training', async () => {
    const { ctrl } = make({}, detail({ status: 'stopped', roomCode: null, uninstalled: { count: 0, total: 2 } }));
    await ctrl.openReport();
    expect(ctrl.getState().report).not.toBeNull();
    ctrl.openDataExport();
    expect(ctrl.getState()).toMatchObject({ report: null, dataExport: { mode: 'today' } });
    await flush();
    await ctrl.openReport();
    expect(ctrl.getState().dataExport).toBeNull();
    ctrl.openDataExport();
    await flush();
    ctrl.askEnd();
    await ctrl.confirm();
    expect(ctrl.getState().dataExport).toBeNull();
  });

  it('is not offered once the training ended', () => {
    const { ctrl } = make({}, detail({ status: 'ended', roomCode: null, members: [] }));
    ctrl.openDataExport();
    expect(ctrl.getState().dataExport).toBeNull();
  });

  it('a member who left meanwhile is dropped from the choice instead of making the server refuse it', async () => {
    const { ctrl, gateway } = make({ get: vi.fn(async () => detail({ members: [member(1, 'An')] })) });
    ctrl.openDataExport();
    await flush();
    ctrl.setDataExportAllMembers(false);
    await flush();
    expect(ctrl.getState().dataExport!.memberIds).toEqual([1, 2]);
    await ctrl.refresh(); // Bình was invited out
    ctrl.setDataExportMode('day');
    await flush();
    expect(ctrl.getState().dataExport!.memberIds).toEqual([1]);
    expect(gateway.exportSummary).toHaveBeenLastCalledWith(5, { from: '2026-11-24', memberIds: [1] });
  });
});

describe('TrainingController: day groups', () => {
  const at = (d: number, h = 9) => new Date(2026, 10, d, h, 0).getTime();
  const D22 = '2026-11-22', D23 = '2026-11-23', D24 = '2026-11-24', D25 = '2026-11-25';
  // 1 prompt on 22/11 with a failing command, 2 prompts on 23/11 (the second has a command), 1 prompt on 24/11.
  const days = (): TrainingEventRow[] => [
    ev(1, { kind: 'prompt', prompt: 'a', receivedAt: at(22) }), ev(2, { receivedAt: at(22, 10), hasOutput: true }),
    ev(3, { kind: 'prompt', prompt: 'b', receivedAt: at(23) }), ev(4, { kind: 'prompt', prompt: 'c', receivedAt: at(23, 11) }), ev(5, { receivedAt: at(23, 11), hasOutput: true }),
    ev(6, { kind: 'prompt', prompt: 'd', receivedAt: at(24) }),
  ];
  async function opened(rows: TrainingEventRow[], flags: TrainingEventsPage['flags'] = []) {
    let all = rows;
    const events = vi.fn(async (_t: number, _m: number, after = 0): Promise<TrainingEventsPage> => ({ events: all.filter(e => e.id > after), hasMore: false, flags }));
    const made = make({ events });
    made.ctrl.select(1);
    await flush();
    return { ...made, push: (...more: TrainingEventRow[]) => { all = [...all, ...more]; } };
  }
  const open = (c: TrainingController) => [...c.getState().timeline!.openDays].sort();

  it('opens only the newest day when there are several; the only day when there is one', async () => {
    expect(open((await opened(days())).ctrl)).toEqual([D24]);
    expect(open((await opened(days().slice(0, 2))).ctrl)).toEqual([D22]);
  });

  it('opens and folds a day, and opens or folds them all', async () => {
    const { ctrl } = await opened(days());
    ctrl.toggleDay(D22);
    expect(open(ctrl)).toEqual([D22, D24]);
    ctrl.toggleDay(D24);
    expect(open(ctrl)).toEqual([D22]);
    ctrl.setAllOpen(true);
    expect(open(ctrl)).toEqual([D22, D23, D24]);
    ctrl.setAllOpen(false);
    expect(open(ctrl)).toEqual([]);
  });

  it('another member starts again from the default', async () => {
    const { ctrl } = await opened(days());
    ctrl.setAllOpen(true);
    ctrl.select(2);
    await flush();
    expect(open(ctrl)).toEqual([D24]);
  });

  it('a flag chip opens the folded day of the event it jumps to', async () => {
    const { ctrl } = await opened(days(), [{ code: 'touches_tests', eventIds: [2] }, { code: 'repeated_request', eventIds: [3] }]);
    ctrl.jumpToFlag('touches_tests');
    expect(open(ctrl)).toEqual([D22, D24]);
    ctrl.jumpToFlag('repeated_request');
    expect(open(ctrl)).toEqual([D22, D23, D24]);
  });

  it('the chip of a day goes only through the events of that day, and opens it', async () => {
    const { ctrl } = await opened(days(), [{ code: 'touches_tests', eventIds: [2, 3, 6] }]);
    ctrl.jumpToFlag('touches_tests', D23);
    expect(ctrl.getState().timeline?.focusId).toBe(3);
    expect(open(ctrl)).toEqual([D23, D24]);
    ctrl.jumpToFlag('touches_tests', D23);
    expect(ctrl.getState().timeline?.focusId).toBe(3); // the only one of that day
    const token = ctrl.getState().timeline!.focusToken;
    ctrl.jumpToFlag('touches_tests', D25); // nothing of that flag on that day
    expect(ctrl.getState().timeline?.focusToken).toBe(token);
  });

  it('opening the detail of a turn opens its day', async () => {
    const { ctrl } = await opened(days());
    ctrl.openTurn('t4');
    expect(open(ctrl)).toEqual([D23, D24]);
  });

  it('J / K to a command in a folded day opens that day', async () => {
    const { ctrl } = await opened(days());
    await ctrl.openDetail(5, 'output'); // command of 23/11, which is folded
    expect(open(ctrl)).toEqual([D24]);
    ctrl.step(-1);
    expect(ctrl.getState().panel?.eventId).toBe(2);
    expect(open(ctrl)).toEqual([D22, D24]);
  });

  it('a day that appears while watching opens by itself; the other days keep their state', async () => {
    const { ctrl, push } = await opened(days());
    ctrl.toggleDay(D22);
    ctrl.toggleDay(D24);
    expect(open(ctrl)).toEqual([D22]);
    push(ev(7, { kind: 'prompt', prompt: 'e', receivedAt: at(25) }));
    await ctrl.refresh();
    expect(open(ctrl)).toEqual([D22, D25]);
    push(ev(8, { kind: 'prompt', prompt: 'f', receivedAt: at(25, 12) }));
    await ctrl.refresh();
    expect(open(ctrl)).toEqual([D22, D25]);
  });

  it('with the newest day folded, the marker in view is not following: new events are counted and the chip opens the day', async () => {
    const { ctrl, push } = await opened(days());
    ctrl.toggleDay(D24);
    ctrl.reportFollowing(true); // today's header is still in view
    const token = ctrl.getState().timeline!.followToken;
    push(ev(7, { receivedAt: at(24, 12) }));
    await ctrl.refresh();
    expect(ctrl.getState().timeline).toMatchObject({ newCount: 1, followToken: token });
    ctrl.jumpToLatest();
    expect(open(ctrl)).toEqual([D24]);
  });

  it('the "N sự kiện mới" chip opens the newest day if it was folded', async () => {
    const { ctrl, push } = await opened(days());
    ctrl.toggleDay(D24);
    ctrl.reportFollowing(false);
    push(ev(7, { receivedAt: at(24, 12) }));
    await ctrl.refresh();
    expect(ctrl.getState().timeline?.newCount).toBe(1);
    ctrl.jumpToLatest();
    expect(open(ctrl)).toEqual([D24]);
    expect(ctrl.getState().timeline?.newCount).toBe(0);
  });
});

describe('TrainingController: session blocks and what has been read (S43)', () => {
  const at = (d: number, h = 9, mi = 0) => new Date(2026, 10, d, h, mi).getTime();
  const D24 = '2026-11-24';
  // Two sessions at once on 24/11: A (ended with /clear) and B (no end signal), prompts interleaved. Member 1 was last seen at 8:00 on 24/11, 1 prompt.
  const sess = (): TrainingEventRow[] => [
    ev(1, { kind: 'prompt', prompt: 'a1', receivedAt: at(24, 7), claudeSessionId: 'A' }),
    ev(2, { kind: 'prompt', prompt: 'a2', receivedAt: at(24, 9), claudeSessionId: 'A' }),
    ev(3, { kind: 'prompt', prompt: 'b1', receivedAt: at(24, 9, 5), claudeSessionId: 'B' }),
    ev(4, { receivedAt: at(24, 9, 6), claudeSessionId: 'A', hasOutput: true }),
    ev(5, { receivedAt: at(24, 9, 7), claudeSessionId: 'B', hasOutput: true }),
    ev(6, { kind: 'session', subtype: 'clear', receivedAt: at(24, 9, 8), claudeSessionId: 'A' }),
  ];
  const A = `b${D24}-s1`, B = `b${D24}-s2`;
  async function opened(rows: TrainingEventRow[], readStore?: TrainingReadStore, lastSeenAt = at(24, 8)) {
    let all = rows;
    const events = vi.fn(async (_t: number, _m: number, after = 0): Promise<TrainingEventsPage> => ({ events: all.filter(e => e.id > after), hasMore: false, flags: [] }));
    const made = make({ events }, detail({ members: [member(1, 'An', { lastSeenAt, promptCount: 1 }), member(2, 'Bình', { lastSeenAt })] }), { readStore });
    made.ctrl.select(1);
    await flush();
    return { ...made, push: (...more: TrainingEventRow[]) => { all = [...all, ...more]; } };
  }
  const blocks = (c: TrainingController) => [...c.getState().timeline!.openBlocks].sort();

  it('opens a block with something unread or no end signal; folds an ended one that was read', async () => {
    // the baseline is 8:00: a2, b1 are new, a1 is not. Block A has unread, block B has no end signal: both open
    expect(blocks((await opened(sess())).ctrl)).toEqual([A, B]);
    // nothing unread and A ended: A folds, B stays open
    expect(blocks((await opened(sess(), undefined, at(24, 23))).ctrl)).toEqual([B]);
  });

  it('a new session opens by itself; the other blocks keep the state the mentor left', async () => {
    const { ctrl, push } = await opened(sess(), undefined, at(24, 23));
    ctrl.toggleBlock(B);
    expect(blocks(ctrl)).toEqual([]);
    push(ev(7, { kind: 'prompt', prompt: 'c1', receivedAt: at(24, 10), claudeSessionId: 'C' }));
    await ctrl.refresh();
    expect(blocks(ctrl)).toEqual([`b${D24}-s3`]);
  });

  it('the block is folded again for another member', async () => {
    const { ctrl } = await opened(sess(), undefined, at(24, 23));
    ctrl.toggleBlock(A);
    ctrl.select(2);
    await flush();
    expect(blocks(ctrl)).toEqual([B]);
  });

  it('a flag chip, J / K and the detail of a turn open the folded block as well as the day', async () => {
    const { ctrl } = await opened(sess(), undefined, at(24, 23));
    expect(blocks(ctrl)).toEqual([B]);
    await ctrl.openDetail(5, 'output'); // B's command
    ctrl.step(-1); // A is shown above B: the previous command is A's, in a folded block
    expect(ctrl.getState().panel?.eventId).toBe(4);
    expect(blocks(ctrl)).toEqual([A, B]);
    ctrl.setAllOpen(false);
    ctrl.openTurn('t2');
    expect(ctrl.getState().timeline).toMatchObject({ openDays: [D24], openBlocks: [A] });
  });

  it('"Mở tất cả" opens days and blocks, "Thu tất cả" folds both', async () => {
    const { ctrl } = await opened(sess());
    ctrl.setAllOpen(false);
    expect(ctrl.getState().timeline).toMatchObject({ openDays: [], openBlocks: [] });
    ctrl.setAllOpen(true);
    expect(ctrl.getState().timeline).toMatchObject({ openDays: [D24], openBlocks: [A, B] });
  });

  it('revealTurn opens the day and block of the turn and asks the page to scroll to its prompt', async () => {
    const { ctrl } = await opened(sess(), undefined, at(24, 23));
    ctrl.toggleBlock(B);
    ctrl.revealTurn('t3');
    expect(blocks(ctrl)).toEqual([B]);
    expect(ctrl.getState().timeline).toMatchObject({ revealId: 3, revealToken: 1 });
  });

  it('"Song song với phiên M" opens that block and its day and asks to scroll to it', async () => {
    const { ctrl } = await opened(sess(), undefined, at(24, 23));
    ctrl.setAllOpen(false);
    ctrl.revealBlock(B);
    expect(ctrl.getState().timeline).toMatchObject({ openDays: [D24], openBlocks: [B], revealBlockKey: B, revealBlockToken: 1 });
    ctrl.revealBlock('nope');
    expect(ctrl.getState().timeline!.revealBlockToken).toBe(1);
  });

  it('following needs the newest prompt to be shown, wherever its block is', async () => {
    const { ctrl, push } = await opened(sess(), undefined, at(24, 23));
    ctrl.reportFollowing(true);
    ctrl.toggleBlock(B); // b1 is the newest prompt and its block is folded
    const token = ctrl.getState().timeline!.followToken;
    push(ev(7, { kind: 'prompt', prompt: 'b2', receivedAt: at(24, 10), claudeSessionId: 'B' }));
    await ctrl.refresh();
    expect(ctrl.getState().timeline).toMatchObject({ newCount: 1, followToken: token });
  });

  it('remembers each member the first time they are seen, and keeps it in the store', async () => {
    const store = new InMemoryTrainingReadStore();
    const { ctrl } = await opened(sess(), store);
    expect(ctrl.getState().read.members['1']).toMatchObject({ baselineAt: at(24, 8), baselinePromptCount: 1 });
    expect(store.load(5).members['2']).toBeDefined();
    // another page load starts from what was stored
    const again = make({}, detail(), { readStore: store });
    expect(again.ctrl.getState().read.members['1']).toMatchObject({ baselineAt: at(24, 8) });
  });

  it('markTurnRead reads up to the id given; an event that came after stays new', async () => {
    const store = new InMemoryTrainingReadStore();
    const { ctrl } = await opened(sess(), store);
    ctrl.markTurnRead('2', 2); // turn of prompt a2: its prompt is read, the command 4 is not
    expect(store.load(5).members['1']!.turns['2']).toBe(2);
    ctrl.markTurnRead('2', 1); // a lower mark changes nothing
    expect(store.load(5).members['1']!.turns['2']).toBe(2);
    ctrl.toggleHidden();
    ctrl.markTurnRead('3', 3); // hidden content: nothing is counted
    expect(store.load(5).members['1']!.turns['3']).toBeUndefined();
  });

  describe('"Đánh dấu đã đọc hết"', () => {
    it('reads every loaded turn of the member in view, and undo puts it back exactly, within 5 seconds', async () => {
      vi.useFakeTimers();
      try {
        const store = new InMemoryTrainingReadStore();
        const made = await (async () => { const p = opened(sess(), store); await vi.advanceTimersByTimeAsync(10); return p; })();
        const { ctrl } = made;
        const before = ctrl.getState().read.members['1'];
        ctrl.markAllRead();
        expect(Object.keys(store.load(5).members['1']!.turns)).toEqual(['1', '2', '3']);
        expect(ctrl.getState().undo).toEqual({ memberId: 1 });
        ctrl.undoMarkAllRead();
        expect(ctrl.getState().undo).toBeNull();
        expect(store.load(5).members['1']).toEqual(before);
        ctrl.markAllRead();
        vi.advanceTimersByTime(5000);
        expect(ctrl.getState().undo).toBeNull(); // the chance to undo is over, the mark stays
        expect(Object.keys(store.load(5).members['1']!.turns)).toHaveLength(3);
        ctrl.undoMarkAllRead(); // nothing to undo any more
        expect(Object.keys(store.load(5).members['1']!.turns)).toHaveLength(3);
      } finally { vi.useRealTimers(); }
    });
  });

  it('an ended training keeps no record', async () => {
    const store = new InMemoryTrainingReadStore();
    const { ctrl } = await opened(sess(), store);
    expect(store.load(5).members['1']).toBeDefined();
    await ctrl.confirm(); // no confirm open: nothing
    ctrl.askStop();
    await ctrl.confirm();
    ctrl.askEnd();
    await ctrl.confirm();
    expect(ctrl.getState().detail.status).toBe('ended');
    expect(store.load(5)).toEqual({ members: {} });
    expect(ctrl.getState().read).toEqual({ members: {} });
  });
});


describe('TrainingController: teaching examples (S44)', () => {
  const withPrompt = (over: Partial<TrainingEventRow> = {}) => ({ events: vi.fn(async () => ({ events: [ev(10, { kind: 'prompt', prompt: 'viết hàm add', ...over, toolName: undefined, toolTarget: undefined, ok: undefined })], hasMore: false, flags: [] })) });
  const open = async (over: Partial<TrainingAdminGateway> = {}, initial = detail()) => {
    const m = make({ ...withPrompt(), ...over }, initial, { initialMemberId: 1 });
    m.ctrl.start();
    await flush();
    return m;
  };

  it('does not open for a member who did not agree, nor for a row that is not a prompt', async () => {
    const { ctrl } = await open({}, detail({ members: [member(1, 'An', { teachingConsent: false })] }));
    ctrl.openTeaching(10);
    expect(ctrl.getState().teachingEdit).toBeNull();
    const ok = await open();
    ok.ctrl.openTeaching(99);
    expect(ok.ctrl.getState().teachingEdit).toBeNull();
  });

  it('opens empty for a new example, needs a label and a comment, and saves with the form (null for what is empty)', async () => {
    const { ctrl, gateway } = await open();
    ctrl.openTeaching(10);
    expect(ctrl.getState().teachingEdit).toMatchObject({ eventId: 10, memberName: 'An', prompt: 'viết hàm add', exists: false, phase: 'ready', form: { label: '', topic: 'other', comment: '', betterPrompt: '' } });
    await ctrl.saveTeaching();
    expect(gateway.saveTeachingExample).not.toHaveBeenCalled(); // no label, no comment

    ctrl.setTeachingForm({ label: 'needs_work', topic: 'verify' });
    await ctrl.saveTeaching();
    expect(gateway.saveTeachingExample).not.toHaveBeenCalled(); // still no comment
    ctrl.setTeachingForm({ comment: '  Chưa nói cách kiểm tra  ' });
    await ctrl.saveTeaching();
    expect(gateway.saveTeachingExample).toHaveBeenCalledWith(5, 10, { label: 'needs_work', topic: 'verify', comment: 'Chưa nói cách kiểm tra', betterPrompt: null, editedPrompt: null, editedContext: null });
    expect(ctrl.getState().teachingEdit).toBeNull();
    expect(ctrl.getState().timeline!.events.find(e => e.id === 10)!.teachingExample).toEqual({ label: 'needs_work' }); // the row shows what the server answered
  });

  it('fills the form from the existing example, keeps the review edits on save, and can drop it', async () => {
    const existing = teachingRow(10, { label: 'good', topic: 'stuck', comment: 'Rõ ràng', betterPrompt: 'tốt hơn' }, { editedPrompt: 'đã sửa', editedContext: null });
    const { ctrl, gateway } = await open({ ...withPrompt({ teachingExample: { label: 'good' } }), teachingExamples: vi.fn(async () => [existing]) });
    ctrl.openTeaching(10);
    expect(ctrl.getState().teachingEdit).toMatchObject({ exists: true, phase: 'loading' });
    await flush();
    expect(ctrl.getState().teachingEdit).toMatchObject({ phase: 'ready', form: { label: 'good', topic: 'stuck', comment: 'Rõ ràng', betterPrompt: 'tốt hơn' } });
    ctrl.setTeachingForm({ comment: 'Rõ ràng, có ví dụ' });
    await ctrl.saveTeaching();
    expect(gateway.saveTeachingExample).toHaveBeenCalledWith(5, 10, expect.objectContaining({ comment: 'Rõ ràng, có ví dụ', editedPrompt: 'đã sửa', editedContext: null }));

    ctrl.openTeaching(10);
    await flush();
    await ctrl.removeTeaching();
    expect(gateway.deleteTeachingExample).toHaveBeenCalledWith(5, 10);
    expect(ctrl.getState().timeline!.events.find(e => e.id === 10)!.teachingExample).toBeNull();
    expect(ctrl.getState().teachingEdit).toBeNull();
  });

  it('shows the server\'s reason in the dialog and keeps it open (the member did not agree)', async () => {
    const { ctrl } = await open({ saveTeachingExample: vi.fn(async () => { throw new ApiError(409, 'Bạn này không đồng ý cho dùng làm ví dụ', 'no_teaching_consent'); }) });
    ctrl.openTeaching(10);
    ctrl.setTeachingForm({ label: 'good', comment: 'ok' });
    await ctrl.saveTeaching();
    expect(ctrl.getState().teachingEdit).toMatchObject({ saving: false, error: 'Bạn này không đồng ý cho dùng làm ví dụ' });
  });

  it('a failed load of the existing example can be retried', async () => {
    const load = vi.fn().mockRejectedValueOnce(new ApiError(0, 'Không kết nối được')).mockResolvedValue([teachingRow(10, { comment: 'Rõ' })]);
    const { ctrl } = await open({ ...withPrompt({ teachingExample: { label: 'good' } }), teachingExamples: load });
    ctrl.openTeaching(10);
    await flush();
    expect(ctrl.getState().teachingEdit).toMatchObject({ phase: 'error', error: 'Không kết nối được' });
    ctrl.retryTeaching();
    await flush();
    expect(ctrl.getState().teachingEdit).toMatchObject({ phase: 'ready', form: { comment: 'Rõ' } });
  });

  describe('the review screen', () => {
    const rows = () => [teachingRow(10, {}, { memberName: 'An' }), teachingRow(11, { label: 'needs_work' }, { memberName: 'Bình', editedPrompt: 'đã bỏ tên', defaultPrompt: 'gốc có tên' })];
    const review = async (over: Partial<TrainingAdminGateway> = {}, saveFile = vi.fn()) => {
      const m = make({ teachingExamples: vi.fn(async () => rows()), ...over }, detail(), { saveFile });
      await m.ctrl.openTeachingReview();
      return { ...m, saveFile };
    };

    it('loads every example with the masked original as the starting text, or the stored edit', async () => {
      const { ctrl } = await review();
      const r = ctrl.getState().teachingReview!;
      expect(r).toMatchObject({ phase: 'ready', selectedId: 10 });
      expect(r.items.map(i => i.reviewed)).toEqual([false, false]);
      expect(r.items.map(i => [i.promptDraft, i.contextDraft])).toEqual([['prompt gốc', '✓ Bash ls'], ['đã bỏ tên', '✓ Bash ls']]);
    });

    it('says there is nothing to export when there is no example, and says when loading failed', async () => {
      const { ctrl } = await review({ teachingExamples: vi.fn(async () => []) });
      expect(ctrl.getState().teachingReview).toMatchObject({ phase: 'ready', items: [] });
      await ctrl.downloadTeaching();
      const bad = await review({ teachingExamples: vi.fn(async () => { throw new ApiError(0, 'Mất mạng'); }) });
      expect(bad.ctrl.getState().teachingReview).toMatchObject({ phase: 'error', error: 'Mất mạng' });
    });

    const markAll = async (ctrl: TrainingController) => { for (const i of [...ctrl.getState().teachingReview!.items]) await ctrl.markReviewed(i.eventId); };

    it('does not download until every example is reviewed, and any edit takes that example back to "chưa rà"', async () => {
      const { ctrl, gateway, saveFile } = await review();
      await ctrl.downloadTeaching();
      expect(gateway.exportTeachingExamples).not.toHaveBeenCalled();
      await ctrl.markReviewed(10);
      expect(gateway.setTeachingReviewed).toHaveBeenCalledWith(5, 10, true);
      await ctrl.downloadTeaching();
      expect(gateway.exportTeachingExamples).not.toHaveBeenCalled(); // one is left
      ctrl.editReviewPrompt(10, 'prompt đã bỏ tên dự án');
      expect(ctrl.getState().teachingReview!.items[0]!.reviewed).toBe(false);
      await markAll(ctrl);
      await ctrl.downloadTeaching();
      expect(gateway.exportTeachingExamples).toHaveBeenCalledWith(5);
      expect(saveFile).toHaveBeenCalledWith('vi-du-buoi-1.md', '# Ví dụ');
      expect(ctrl.getState().teachingReview).toMatchObject({ saved: true, saving: false });
    });

    it('"Đã rà ví dụ này, sang tiếp" saves the edits first, marks it and moves to the next example not reviewed (wrapping round)', async () => {
      const { ctrl, gateway } = await review();
      ctrl.selectReviewItem(11);
      ctrl.editReviewPrompt(11, 'đã sửa nữa');
      await ctrl.markReviewed(11);
      expect(gateway.saveTeachingExample).toHaveBeenCalledWith(5, 11, expect.objectContaining({ editedPrompt: 'đã sửa nữa' }));
      expect(gateway.setTeachingReviewed).toHaveBeenCalledWith(5, 11, true);
      expect(ctrl.getState().teachingReview).toMatchObject({ selectedId: 10 }); // wrapped round to the first one left
      await ctrl.markReviewed(10);
      expect(ctrl.getState().teachingReview).toMatchObject({ selectedId: 10 }); // nothing left: stays
    });

    it('a click on "Đã rà ví dụ này" right after typing waits for the save the blur started: nothing is lost, and the order is save, then mark', async () => {
      const gate = deferred<TeachingExampleRow>();
      const calls: string[] = [];
      const save = vi.fn(async () => { calls.push('save'); return gate.promise; });
      const set = vi.fn(async () => { calls.push('mark'); });
      const { ctrl } = await review({ saveTeachingExample: save, setTeachingReviewed: set });
      ctrl.editReviewPrompt(10, 'đã sửa');
      void ctrl.commitReviewItem(10); // the blur
      await flush();
      expect(ctrl.getState().teachingReview!.items[0]!.saving).toBe(true);
      const click = ctrl.markReviewed(10); // the click, while that save is running
      await flush();
      expect(set).not.toHaveBeenCalled();
      gate.resolve(teachingRow(10));
      await click;
      expect(calls).toEqual(['save', 'mark']);
      expect(save).toHaveBeenCalledTimes(1); // the click found nothing left to save
      expect(ctrl.getState().teachingReview!.items[0]).toMatchObject({ reviewed: true, saving: false });
    });

    it('a failed save of "đã rà" says so on the example and keeps it not reviewed; it can be taken back', async () => {
      const set = vi.fn().mockRejectedValueOnce(new ApiError(500, 'Lỗi máy chủ')).mockResolvedValue(undefined);
      const { ctrl } = await review({ setTeachingReviewed: set });
      await ctrl.markReviewed(10);
      expect(ctrl.getState().teachingReview!.items[0]).toMatchObject({ reviewed: false, error: 'Lỗi máy chủ', saving: false });
      await ctrl.markReviewed(10);
      expect(ctrl.getState().teachingReview!.items[0]).toMatchObject({ reviewed: true, error: '' });
      await ctrl.unmarkReviewed(10);
      expect(set).toHaveBeenLastCalledWith(5, 10, false);
      expect(ctrl.getState().teachingReview!.items[0]!.reviewed).toBe(false);
    });

    it('the examples a name was suspected in: "Thay bằng [bạn]" replaces every whole-word place with the same accents (case ignored; "Binh" stays) and saves; "Không phải tên" only hides the warning here', async () => {
      const { ctrl, gateway } = await review({ teachingExamples: vi.fn(async () => [teachingRow(10, {}, { editedPrompt: 'Bình đây, bình sửa lỗi', defaultPrompt: 'x', comment: 'Anh Bình hay quên, Binh thì không' })]) });
      ctrl.replaceReviewName(10, 'Bình');
      const i = ctrl.getState().teachingReview!.items[0]!;
      expect(i).toMatchObject({ promptDraft: '[bạn] đây, [bạn] sửa lỗi', commentDraft: 'Anh [bạn] hay quên, Binh thì không', reviewed: false });
      await flush();
      expect(gateway.saveTeachingExample).toHaveBeenCalledWith(5, 10, expect.objectContaining({ comment: 'Anh [bạn] hay quên, Binh thì không', editedPrompt: '[bạn] đây, [bạn] sửa lỗi' }));
      ctrl.dismissReviewName(10, 'An');
      expect(ctrl.getState().teachingReview!.items[0]!.dismissed).toEqual(['An']);
      expect(gateway.saveTeachingExample).toHaveBeenCalledTimes(1); // nothing sent for a dismissal
    });

    it('saves an edit when the box loses focus: only what differs from the original is sent, and an unchanged draft sends nothing', async () => {
      const { ctrl, gateway } = await review();
      expect(await ctrl.commitReviewItem(10)).toBe(true);
      expect(gateway.saveTeachingExample).not.toHaveBeenCalled();
      ctrl.editReviewContext(10, '✓ Bash ls\n✗ Bash npm test');
      await ctrl.commitReviewItem(10);
      expect(gateway.saveTeachingExample).toHaveBeenCalledWith(5, 10, expect.objectContaining({ label: 'good', editedPrompt: null, editedContext: '✓ Bash ls\n✗ Bash npm test' }));
      expect(ctrl.getState().teachingReview!.items[0]).toMatchObject({ saving: false, savedContext: '✓ Bash ls\n✗ Bash npm test', error: '' });
    });

    it('"Về bản gốc" puts both texts back to the original and saves that (editedPrompt / editedContext null)', async () => {
      const { ctrl, gateway } = await review();
      ctrl.resetReviewItem(11);
      await flush();
      expect(ctrl.getState().teachingReview!.items[1]).toMatchObject({ promptDraft: 'gốc có tên', contextDraft: '✓ Bash ls' });
      expect(gateway.saveTeachingExample).toHaveBeenCalledWith(5, 11, expect.objectContaining({ editedPrompt: null, editedContext: null }));
    });

    it('download first saves the unsaved edits; a save that fails stops the download and says which', async () => {
      const save = vi.fn(async () => { throw new ApiError(500, 'Lỗi máy chủ'); });
      const { ctrl, gateway } = await review({ saveTeachingExample: save });
      await markAll(ctrl);
      ctrl.editReviewPrompt(10, 'sửa');
      await ctrl.downloadTeaching();
      expect(gateway.exportTeachingExamples).not.toHaveBeenCalled(); // edited again: that example is not reviewed any more
      expect(await ctrl.commitReviewItem(10)).toBe(false);
      const r = ctrl.getState().teachingReview!;
      expect(r.items[0]).toMatchObject({ error: 'Lỗi máy chủ', saving: false, reviewed: false });
      expect(r.saving).toBe(false);
    });

    it('a text over the limit is refused before any request', async () => {
      const { ctrl, gateway } = await review();
      ctrl.editReviewPrompt(10, 'x'.repeat(4001));
      expect(await ctrl.commitReviewItem(10)).toBe(false);
      expect(gateway.saveTeachingExample).not.toHaveBeenCalled();
      expect(ctrl.getState().teachingReview!.items[0]!.error).toMatch(/quá dài/);
    });

    it('does not download while the content is hidden (the mentor cannot review what is not shown)', async () => {
      const { ctrl, gateway } = await review();
      await markAll(ctrl);
      ctrl.setHidden(true);
      await ctrl.downloadTeaching();
      expect(gateway.exportTeachingExamples).not.toHaveBeenCalled();
    });

    it('shows the server\'s message when the file cannot be made (no examples left), and does not mark it saved', async () => {
      const { ctrl } = await review({ exportTeachingExamples: vi.fn(async () => { throw new ApiError(404, 'Chưa có ví dụ nào để xuất', 'no_examples'); }) });
      await markAll(ctrl);
      await ctrl.downloadTeaching();
      expect(ctrl.getState().teachingReview).toMatchObject({ saved: false, saveError: 'Chưa có ví dụ nào để xuất' });
    });

    it('from the "Kết thúc" prompt the examples export opens in its place, and a download reloads the count', async () => {
      const m = make({ teachingExamples: vi.fn(async () => rows()) }, detail({ status: 'stopped', roomCode: null, unexportedExampleCount: 2 }));
      m.ctrl.askEnd();
      expect(m.ctrl.getState().confirm).toEqual({ kind: 'end' });
      m.ctrl.exportExamplesBeforeEnding();
      expect(m.ctrl.getState().confirm).toBeNull();
      await flush();
      expect(m.ctrl.getState().teachingReview).toMatchObject({ phase: 'ready' });
      for (const i of [...m.ctrl.getState().teachingReview!.items]) await m.ctrl.markReviewed(i.eventId);
      const before = (m.gateway.get as ReturnType<typeof vi.fn>).mock.calls.length;
      await m.ctrl.downloadTeaching();
      await flush();
      expect((m.gateway.get as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(before);
    });

    it('an edit saved on the review screen reloads the training, and "Kết thúc" reloads it again, so the example reminder is never stale', async () => {
      const stopped = (n: number) => detail({ status: 'stopped', roomCode: null, unexportedExampleCount: n });
      const get = vi.fn(async () => stopped(0));
      const m = make({ teachingExamples: vi.fn(async () => rows()), get }, stopped(0));
      await m.ctrl.openTeachingReview();
      get.mockResolvedValue(stopped(1)); // the server now counts the edited example
      m.ctrl.editReviewPrompt(10, 'sửa');
      await m.ctrl.commitReviewItem(10);
      await flush();
      expect(m.ctrl.getState().detail.unexportedExampleCount).toBe(1);

      m.ctrl.closeTeachingReview();
      get.mockResolvedValue(stopped(2)); // changed behind the page's back (no live signal once stopped)
      m.ctrl.askEnd();
      expect(m.ctrl.getState().confirm).toEqual({ kind: 'end' });
      await flush();
      expect(m.ctrl.getState().detail.unexportedExampleCount).toBe(2);
    });

    it('opening the report or the data export closes the review, and the end of the training closes everything', async () => {
      const { ctrl } = await review();
      await ctrl.openReport();
      expect(ctrl.getState().teachingReview).toBeNull();
      await ctrl.openTeachingReview();
      expect(ctrl.getState().report).toBeNull();
      ctrl.openDataExport();
      expect(ctrl.getState().teachingReview).toBeNull();
    });
  });
});
