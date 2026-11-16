import { describe, expect, it, vi } from 'vitest';
import type { GroupDetail, GroupSummary } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { GroupsGateway } from './groups-gateway.js';
import { GroupsController } from './groups-controller.js';

const summary = (id: number, name: string, n: number): GroupSummary => ({ id, name, emailCount: n, createdAt: 0, updatedAt: 0, lastUsedAt: null });
const detail = (id: number, name: string, emails: string[]): GroupDetail => ({ ...summary(id, name, emails.length), emails });

function make(over: Partial<GroupsGateway> = {}, initial: GroupSummary[] = []) {
  const gateway: GroupsGateway = {
    list: vi.fn(async () => [summary(1, 'Lớp', 2)]),
    get: vi.fn(async id => detail(id, 'Lớp', ['a@x.com', 'b@x.com'])),
    create: vi.fn(async i => detail(1, i.name, i.emails)),
    update: vi.fn(async (id, i) => detail(id, i.name, i.emails)),
    remove: vi.fn(async () => {}),
    ...over,
  };
  return { gateway, ctrl: new GroupsController(gateway, initial) };
}

describe('GroupsController', () => {
  it('creates a group from the pasted text: only the clean emails are sent, then the group is open and listed', async () => {
    const { ctrl, gateway } = make();
    ctrl.edit({ name: ' Lớp ', defaultDomain: 'x.com', text: 'a@x.com\nb\nA@x.com\nphi89@' });
    await ctrl.save();
    expect(gateway.create).toHaveBeenCalledWith({ name: 'Lớp', emails: ['a@x.com', 'b@x.com'] });
    expect(ctrl.getState()).toMatchObject({ selected: 1, saving: false, error: '', notice: 'Đã lưu nhóm · 2 email', groups: [{ id: 1 }] });
    expect(ctrl.getState().draft.text).toBe('a@x.com\nb@x.com'); // the editor shows what was really saved
  });

  it('does not call the server when something blocks saving; says what', async () => {
    const { ctrl, gateway } = make();
    ctrl.edit({ name: 'Lớp', text: 'bad@' });
    await ctrl.save();
    expect(gateway.create).not.toHaveBeenCalled();
    expect(ctrl.getState().error).toBe('Cần ít nhất một email hợp lệ');
  });

  it('a save that fails keeps what was typed and shows the server message', async () => {
    const { ctrl } = make({ create: async () => { throw new ApiError(409, 'Đã có một nhóm tên này'); } });
    ctrl.edit({ name: 'Lớp', text: 'a@x.com' });
    await ctrl.save();
    expect(ctrl.getState()).toMatchObject({ error: 'Đã có một nhóm tên này', saving: false });
    expect(ctrl.getState().draft.text).toBe('a@x.com');
  });

  it('opens a saved group as one email per line and updates it', async () => {
    const { ctrl, gateway } = make();
    await ctrl.open(1);
    expect(ctrl.getState()).toMatchObject({ selected: 1, draft: { name: 'Lớp', text: 'a@x.com\nb@x.com' } });
    ctrl.edit({ text: 'a@x.com\nb@x.com\nc@x.com' });
    await ctrl.save();
    expect(gateway.update).toHaveBeenCalledWith(1, { name: 'Lớp', emails: ['a@x.com', 'b@x.com', 'c@x.com'] });
  });

  it('deleting asks first, then returns to a new empty group with a note that sessions are untouched', async () => {
    const { ctrl, gateway } = make();
    await ctrl.open(1);
    ctrl.askDelete(true);
    expect(ctrl.getState().confirmDelete).toBe(true);
    await ctrl.remove();
    expect(gateway.remove).toHaveBeenCalledWith(1);
    expect(ctrl.getState()).toMatchObject({ selected: 'new', confirmDelete: false });
    expect(ctrl.getState().notice).toContain('không bị ảnh hưởng');
  });

  it('newGroup clears the editor; open failures show a message', async () => {
    const { ctrl } = make({ get: async () => { throw new ApiError(404, 'Không tìm thấy nhóm'); } });
    ctrl.edit({ name: 'x' });
    ctrl.newGroup();
    expect(ctrl.getState().draft.name).toBe('');
    await ctrl.open(9);
    expect(ctrl.getState().error).toBe('Không tìm thấy nhóm');
  });
});
