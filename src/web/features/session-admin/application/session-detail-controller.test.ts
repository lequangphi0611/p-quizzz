import { describe, expect, it, vi } from 'vitest';
import type { SessionDetail } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { SessionDetailController } from './session-detail-controller.js';
import type { SessionAdminGateway } from './session-admin-gateway.js';

const detail = (over: Partial<SessionDetail> = {}): SessionDetail => ({ id: 5, status: 'lobby', participants: [], ...over } as unknown as SessionDetail);

function make(over: Partial<SessionAdminGateway> = {}, initial = detail()) {
  const gateway = {
    getSession: vi.fn(async () => detail({ status: 'lobby' })),
    runAction: vi.fn(async () => detail({ status: 'running' })),
    approveParticipant: vi.fn(async () => {}), kickParticipant: vi.fn(async () => {}), renameParticipant: vi.fn(async () => {}),
    ...over,
  } as unknown as SessionAdminGateway;
  return { gateway, ctrl: new SessionDetailController(gateway, initial) };
}

describe('SessionDetailController', () => {
  it('runs the one next lifecycle action for the status and adopts the response', async () => {
    const { ctrl, gateway } = make();
    ctrl.openDialog({ kind: 'action' });
    await ctrl.doAction();
    expect(gateway.runAction).toHaveBeenCalledWith(5, 'start');
    expect(ctrl.getState().detail.status).toBe('running');
    expect(ctrl.getState()).toMatchObject({ dialog: null, working: false, error: '' });
  });

  it('shows the server message on a refused action (e.g. wrong state) and closes the dialog', async () => {
    const { ctrl } = make({ runAction: async () => { throw new ApiError(409, 'Đã có phiên khác đang chạy') } });
    ctrl.openDialog({ kind: 'action' });
    await ctrl.doAction();
    expect(ctrl.getState()).toMatchObject({ error: 'Đã có phiên khác đang chạy', dialog: null, working: false });
  });

  it('uses a generic message when the failure is not an ApiError', async () => {
    const { ctrl } = make({ runAction: async () => { throw new Error('x'); } });
    await ctrl.doAction();
    expect(ctrl.getState().error).toBe('Không thể bắt đầu');
  });

  it('does nothing when no action is left (finalized)', async () => {
    const { ctrl, gateway } = make({}, detail({ status: 'finalized' }));
    await ctrl.doAction();
    expect(gateway.runAction).not.toHaveBeenCalled();
  });

  it('a stale refetch never overwrites a newer action response', async () => {
    let release!: (d: SessionDetail) => void;
    const { ctrl } = make({ getSession: () => new Promise(r => { release = r; }) });
    const pending = ctrl.refetch();
    await ctrl.doAction(); // action response arrives first (status running)
    release(detail({ status: 'lobby' })); // the older refetch finishes later
    await pending;
    expect(ctrl.getState().detail.status).toBe('running');
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
});
