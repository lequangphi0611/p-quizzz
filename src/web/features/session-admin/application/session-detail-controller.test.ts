import { describe, expect, it, vi } from 'vitest';
import type { SessionDetail } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { SessionDetailController } from './session-detail-controller.js';
import type { SessionAdminGateway } from './session-admin-gateway.js';

const detail = (over: Partial<SessionDetail> = {}): SessionDetail => ({ id: 5, status: 'lobby', participants: [], ...over } as unknown as SessionDetail);

function make(over: Partial<SessionAdminGateway> = {}, initial = detail()) {
  const gateway = {
    getSession: vi.fn(async () => detail({ status: 'lobby' })),
    runAction: vi.fn(async (_id: number, action: string) => detail({ status: action === 'close' ? 'closed' : 'running' })),
    startCountdown: vi.fn(async () => detail({ status: 'lobby' })),
    approveParticipant: vi.fn(async () => {}), kickParticipant: vi.fn(async () => {}), renameParticipant: vi.fn(async () => {}),
    ...over,
  } as unknown as SessionAdminGateway;
  return { gateway, ctrl: new SessionDetailController(gateway, initial) };
}

describe('SessionDetailController', () => {
  it('runs the one next lifecycle action for the status and adopts the response', async () => {
    const { ctrl, gateway } = make({}, detail({ status: 'running' }));
    ctrl.openDialog({ kind: 'action' });
    await ctrl.doAction();
    expect(gateway.runAction).toHaveBeenCalledWith(5, 'close');
    expect(ctrl.getState()).toMatchObject({ dialog: null, working: false, error: '' });
  });

  it('in the lobby "Bắt đầu ngay" starts the 10-second countdown instead of starting at once (PRODUCT.md §7.31c)', async () => {
    const { ctrl, gateway } = make();
    await ctrl.doAction();
    expect(gateway.startCountdown).toHaveBeenCalledWith(5);
    expect(gateway.runAction).not.toHaveBeenCalled();
  });

  it('shows the server message on a refused action (e.g. wrong state) and closes the dialog', async () => {
    const { ctrl } = make({ startCountdown: async () => { throw new ApiError(409, 'Không thể bắt đầu thi khi phiên đang ở trạng thái "Nháp"') } });
    ctrl.openDialog({ kind: 'action' });
    await ctrl.doAction();
    expect(ctrl.getState()).toMatchObject({ error: 'Không thể bắt đầu thi khi phiên đang ở trạng thái "Nháp"', dialog: null, working: false });
  });

  it('uses a generic message when the failure is not an ApiError', async () => {
    const { ctrl } = make({ startCountdown: async () => { throw new Error('x'); } });
    await ctrl.doAction();
    expect(ctrl.getState().error).toBe('Không thể bắt đầu ngay');
  });

  it('does nothing when no action is left (finalized)', async () => {
    const { ctrl, gateway } = make({}, detail({ status: 'finalized' }));
    await ctrl.doAction();
    expect(gateway.runAction).not.toHaveBeenCalled();
  });

  it('a stale refetch never overwrites a newer action response', async () => {
    let release!: (d: SessionDetail) => void;
    const { ctrl } = make({ getSession: () => new Promise(r => { release = r; }) }, detail({ status: "running" }));
    const pending = ctrl.refetch();
    await ctrl.doAction(); // action response arrives first (status closed)
    release(detail({ status: "running" })); // the older refetch finishes later
    await pending;
    expect(ctrl.getState().detail.status).toBe("closed");
  });

  it('approves one or many and refetches', async () => {
    const { ctrl, gateway } = make();
    await ctrl.approve(1);
    await ctrl.approveAll([{ id: 2 }, { id: 3 }]);
    expect(gateway.approveParticipant).toHaveBeenCalledTimes(3);
    expect(gateway.getSession).toHaveBeenCalledTimes(2);
  });

  it('kick goes through the confirm dialog', async () => {
    const { ctrl, gateway } = make();
    await ctrl.kickConfirmed(); // no dialog open: nothing
    expect(gateway.kickParticipant).not.toHaveBeenCalled();
    ctrl.openDialog({ kind: 'kick', p: { id: 9, displayName: 'X', status: 'active' } as never });
    await ctrl.kickConfirmed();
    expect(gateway.kickParticipant).toHaveBeenCalledWith(9);
    expect(ctrl.getState().dialog).toBeNull();
  });

  it('rename reports success so the cell can leave edit mode, and the server message on failure', async () => {
    const a = make();
    expect(await a.ctrl.rename(1, 'N')).toBe(true);
    const b = make({ renameParticipant: async () => { throw new ApiError(409, 'Tên đã được dùng'); } });
    expect(await b.ctrl.rename(1, 'N')).toBe(false);
    expect(b.ctrl.getState().error).toBe('Tên đã được dùng');
  });

  it('adds emails to this session, adopts the returned detail and closes the dialog; a refusal keeps the dialog with the message', async () => {
    const { ctrl, gateway } = make({ addRoster: vi.fn(async () => detail({ status: 'lobby', roster: { size: 3, joined: 0, notJoined: [] } } as Partial<SessionDetail>)) });
    ctrl.openDialog({ kind: 'addRoster' });
    expect(await ctrl.addRoster(['linh@company.vn'])).toBe(true);
    expect(gateway.addRoster).toHaveBeenCalledWith(5, ['linh@company.vn']);
    expect(ctrl.getState()).toMatchObject({ dialog: null, working: false });
    expect(ctrl.getState().detail.roster?.size).toBe(3);

    const bad = make({ addRoster: async () => { throw new ApiError(409, 'Phiên đã kết thúc, không thêm email được nữa'); } });
    bad.ctrl.openDialog({ kind: 'addRoster' });
    expect(await bad.ctrl.addRoster(['a@x.com'])).toBe(false);
    expect(bad.ctrl.getState()).toMatchObject({ error: 'Phiên đã kết thúc, không thêm email được nữa', dialog: { kind: 'addRoster' } });
  });

  it('saves the typed list as a group: closes the dialog, refetches and shows a confirmation that can be dismissed', async () => {
    const { ctrl, gateway } = make({ saveGroup: vi.fn(async () => ({ id: 2, name: '#docker-1511', emailCount: 12 })) });
    ctrl.openDialog({ kind: 'saveGroup' });
    expect(await ctrl.saveGroup('#docker-1511')).toBe(true);
    expect(gateway.saveGroup).toHaveBeenCalledWith(5, '#docker-1511');
    expect(gateway.getSession).toHaveBeenCalled(); // the session now points at the group
    expect(ctrl.getState()).toMatchObject({ dialog: null, notice: 'Đã lưu thành nhóm “#docker-1511” · 12 email' });
    ctrl.dismissNotice();
    expect(ctrl.getState().notice).toBe('');
  });

  it('a name that is taken keeps the dialog open with the server message', async () => {
    const { ctrl } = make({ saveGroup: async () => { throw new ApiError(409, 'Đã có một nhóm tên này'); } });
    ctrl.openDialog({ kind: 'saveGroup' });
    expect(await ctrl.saveGroup('Lớp')).toBe(false);
    expect(ctrl.getState()).toMatchObject({ error: 'Đã có một nhóm tên này', dialog: { kind: 'saveGroup' }, notice: '' });
  });

  it('changes the score visibility and adopts the response; a refusal shows the server message', async () => {
    const setScoreVisibility = vi.fn(async () => detail({ scoreVisibility: 'on_release' }));
    const { ctrl } = make({ setScoreVisibility });
    expect(await ctrl.setScoreVisibility('on_release')).toBe(true);
    expect(setScoreVisibility).toHaveBeenCalledWith(5, 'on_release');
    expect(ctrl.getState().detail.scoreVisibility).toBe('on_release');
    const refused = make({ setScoreVisibility: async () => { throw new ApiError(409, 'Đã có người nộp bài, không đổi cách hiện điểm được nữa'); } });
    expect(await refused.ctrl.setScoreVisibility('on_submit')).toBe(false);
    expect(refused.ctrl.getState().error).toMatch(/nộp bài/);
  });

  it('publishes scores after the confirmation, closes the dialog and says so', async () => {
    const releaseScores = vi.fn(async () => detail({ scoresHidden: false, scoresReleasedAt: 1 }));
    const { ctrl } = make({ releaseScores });
    ctrl.openDialog({ kind: 'releaseScores' });
    expect(await ctrl.releaseScores()).toBe(true);
    expect(releaseScores).toHaveBeenCalledWith(5);
    expect(ctrl.getState()).toMatchObject({ dialog: null, working: false });
    expect(ctrl.getState().detail.scoresHidden).toBe(false);
    expect(ctrl.getState().notice).toMatch(/công bố/);
  });
});
