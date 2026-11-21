import { describe, expect, it, vi } from 'vitest';
import type { TrainingDetail, TrainingEventDetail, TrainingEventRow, TrainingEventsPage, TrainingMemberRow } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { TrainingAdminGateway } from './training-admin-gateway.js';
import { TrainingController } from './training-controller.js';

const ZERO_COUNTS: TrainingDetail['flagCounts'] = { auto_accept: 0, auto_compact_repeated: 0, dangerous_command: 0, edited_not_verified: 0, fast_approvals: 0, long_without_verify: 0, possible_secret: 0, repeated_failure: 0, repeated_request: 0, touches_tests: 0 };

const member = (id: number, displayName: string, over: Partial<TrainingMemberRow> = {}): TrainingMemberRow =>
  ({ id, displayName, connection: 'connected', lastSeenAt: 1, promptCount: 1, toolCount: 1, failedCount: 0, stuck: false, stillSending: false, stoppedSending: false, flags: [], clearCount: 0, compactCount: 0, permissionCount: 0, mentorNote: null, markedCount: 0, ...over });
const detail = (over: Partial<TrainingDetail> = {}): TrainingDetail =>
  ({ id: 5, name: 'Buổi 1', status: 'open', roomCode: '482913', createdAt: 0, stoppedAt: null, endedAt: null, uninstalled: null, allowAutoAccept: false, reportExportedAt: null, flagCounts: ZERO_COUNTS, members: [member(1, 'An'), member(2, 'Bình')], ...over });
const ev = (id: number, over: Partial<TrainingEventRow> = {}): TrainingEventRow =>
  ({ id, kind: 'tool', receivedAt: id, claudeSessionId: 's', toolName: 'Bash', toolTarget: 'ls', ok: true, hasOutput: false, hasChange: false, marked: false, ...over });
const page = (ids: number[], hasMore = false): TrainingEventsPage => ({ events: ids.map(i => ev(i)), hasMore, flags: [] });

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

  it('at the end of the timeline it follows new events; no chip', async () => {
    const { ctrl, push } = await opened();
    const before = ctrl.getState().timeline!.stickToken;
    ctrl.reportScroll(true);
    push(12);
    await ctrl.refresh();
    expect(ctrl.getState().timeline).toMatchObject({ newCount: 0, stickToken: before + 1 });
  });

  it('higher up it does not move: it counts them for the "N sự kiện mới ↓" chip', async () => {
    const { ctrl, push } = await opened();
    const before = ctrl.getState().timeline!.stickToken;
    ctrl.reportScroll(false);
    push(12, 13);
    await ctrl.refresh();
    push(14);
    await ctrl.refresh();
    expect(ctrl.getState().timeline).toMatchObject({ newCount: 3, stickToken: before });
  });

  it('scrolling back to the end clears the chip; the chip jumps to the end', async () => {
    const { ctrl, push } = await opened();
    ctrl.reportScroll(false);
    push(12);
    await ctrl.refresh();
    const token = ctrl.getState().timeline!.stickToken;
    ctrl.jumpToBottom();
    expect(ctrl.getState().timeline).toMatchObject({ newCount: 0, stickToken: token + 1 });

    ctrl.reportScroll(false);
    push(13);
    await ctrl.refresh();
    expect(ctrl.getState().timeline?.newCount).toBe(1);
    ctrl.reportScroll(true);
    expect(ctrl.getState().timeline?.newCount).toBe(0);
  });

  it('a member picked later starts at the end, whatever the scroll position was before', async () => {
    const { ctrl, push } = await opened();
    ctrl.reportScroll(false);
    ctrl.select(2);
    await flush();
    const token = ctrl.getState().timeline!.stickToken;
    push(12);
    await ctrl.refresh();
    expect(ctrl.getState().timeline).toMatchObject({ newCount: 0, stickToken: token + 1 });
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

describe('TrainingController: folding the commands of a turn', () => {
  const twoTurns = (): TrainingEventsPage => ({
    events: [ev(1, { kind: 'prompt', prompt: 'một', toolName: undefined, toolTarget: undefined, ok: undefined }), ev(2), ev(3, { ok: false }),
      ev(4, { kind: 'prompt', prompt: 'hai', toolName: undefined, toolTarget: undefined, ok: undefined }), ev(5)],
    hasMore: false, flags: [{ code: 'repeated_failure', eventIds: [3] }],
  });
  const picked = async () => {
    const m = make({ events: vi.fn(async () => twoTurns()) }, detail(), { initialMemberId: 1 });
    m.ctrl.start();
    await flush();
    return m.ctrl;
  };
  const folded = (c: TrainingController) => [...c.getState().timeline!.collapsed].sort();

  it('starts with every turn open; a turn folds and opens on its own', async () => {
    const c = await picked();
    expect(folded(c)).toEqual([]);
    c.toggleTurn('t1');
    expect(folded(c)).toEqual(['t1']);
    c.toggleTurn('t1');
    expect(folded(c)).toEqual([]);
  });

  it('"thu gọn tất cả" folds every turn that has commands, and "mở tất cả" opens them', async () => {
    const c = await picked();
    c.setAllCollapsed(true);
    expect(folded(c)).toEqual(['t1', 't4']);
    c.setAllCollapsed(false);
    expect(folded(c)).toEqual([]);
  });

  it('a flag chip opens the folded turn it jumps into, and leaves the others folded', async () => {
    const c = await picked();
    c.setAllCollapsed(true);
    c.jumpToFlag('repeated_failure');
    expect(folded(c)).toEqual(['t4']);
    expect(c.getState().timeline!.focusId).toBe(3);
  });

  it('keeps the folded turns when new events arrive', async () => {
    const c = await picked();
    c.toggleTurn('t1');
    await c.refresh();
    expect(folded(c)).toEqual(['t1']);
  });

  it('forgets the folds when another member is picked', async () => {
    const c = await picked();
    c.toggleTurn('t1');
    c.select(2);
    expect(folded(c)).toEqual([]);
  });
});
