import { describe, expect, it, vi } from 'vitest';
import type { CreatedTraining, TrainingSummary } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { TrainingAdminGateway } from './training-admin-gateway.js';
import { TrainingListController } from './training-list-controller.js';
import { InMemoryTrainingReadStore } from './training-read-store.js';

const summary = (id: number, name: string, over: Partial<TrainingSummary> = {}): TrainingSummary => ({ id, name, status: 'open', createdAt: 0, stoppedAt: null, endedAt: null, memberCount: 0, ...over });
const created = (id: number, name: string): CreatedTraining => ({ ...summary(id, name), roomCode: '482913' });
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };

function make(over: Partial<TrainingAdminGateway> = {}, initial: TrainingSummary[] = []) {
  const gateway = {
    list: vi.fn(async () => [summary(1, 'Cũ')]),
    create: vi.fn(async (name: string) => created(9, name)),
    ...over,
  } as unknown as TrainingAdminGateway;
  return { gateway, ctrl: new TrainingListController(gateway, initial) };
}

describe('TrainingListController', () => {
  it('starts with what the route loader fetched (and may be empty)', () => {
    expect(make({}, []).ctrl.getState().items).toEqual([]);
    expect(make({}, [summary(1, 'A')]).ctrl.getState().items).toEqual([summary(1, 'A')]);
  });

  it('creates a training from the trimmed name, puts it first and returns it so the page can open it', async () => {
    const { ctrl, gateway } = make({}, [summary(1, 'Cũ')]);
    ctrl.setName('  Buổi 2  ');
    const made = await ctrl.create();
    expect(gateway.create).toHaveBeenCalledWith('Buổi 2', { allowAutoAccept: false });
    expect(made).toMatchObject({ id: 9, roomCode: '482913' });
    expect(ctrl.getState()).toMatchObject({ name: '', creating: false, createError: '' });
    expect(ctrl.getState().items.map(t => t.id)).toEqual([9, 1]);
    expect(ctrl.getState().items[0]).not.toHaveProperty('roomCode'); // the list never keeps the room code
  });

  it('does not call the server for an empty or too long name, and says why', async () => {
    const { ctrl, gateway } = make();
    ctrl.setName('   ');
    expect(await ctrl.create()).toBeNull();
    expect(ctrl.getState().createError).toBe('Nhập tên buổi training');
    ctrl.setName('x'.repeat(101));
    expect(await ctrl.create()).toBeNull();
    expect(ctrl.getState().createError).toBe('Tên buổi training tối đa 100 ký tự');
    expect(gateway.create).not.toHaveBeenCalled();
    ctrl.setName('ok');
    expect(ctrl.getState().createError).toBe(''); // typing clears the message
  });

  it('passes the auto-accept switch to the new training and resets it afterwards', async () => {
    const { ctrl, gateway } = make();
    ctrl.setName('Buổi 3');
    ctrl.setAllowAutoAccept(true);
    await ctrl.create();
    expect(gateway.create).toHaveBeenCalledWith('Buổi 3', { allowAutoAccept: true });
    expect(ctrl.getState().allowAutoAccept).toBe(false);
  });

  it('a double click creates one training', async () => {
    const slow = deferred<CreatedTraining>();
    const { ctrl, gateway } = make({ create: vi.fn(() => slow.promise) });
    ctrl.setName('A');
    const first = ctrl.create();
    expect(await ctrl.create()).toBeNull();
    expect(ctrl.getState().creating).toBe(true);
    slow.resolve(created(3, 'A'));
    await first;
    expect(gateway.create).toHaveBeenCalledTimes(1);
  });

  it('keeps the typed name and shows the server message when creating fails', async () => {
    const { ctrl } = make({ create: vi.fn(async () => { throw new ApiError(400, 'Tên buổi training không được để trống'); }) });
    ctrl.setName('A');
    expect(await ctrl.create()).toBeNull();
    expect(ctrl.getState()).toMatchObject({ name: 'A', creating: false, createError: 'Tên buổi training không được để trống' });
  });

  it('a list fetched before the new training existed does not wipe it out', async () => {
    const stale = deferred<TrainingSummary[]>();
    const { ctrl } = make({ list: vi.fn(() => stale.promise) });
    const refreshing = ctrl.refresh();
    ctrl.setName('Mới');
    await ctrl.create();
    stale.resolve([summary(1, 'Cũ')]);
    await refreshing;
    expect(ctrl.getState().items.map(t => t.id)).toEqual([9]);
  });

  it('reload shows loading, replaces the list, and reports an error without losing the list', async () => {
    const { ctrl } = make({ list: vi.fn().mockResolvedValueOnce([summary(2, 'Mới')]).mockRejectedValueOnce(new ApiError(0, 'Không kết nối được tới máy chủ')) }, [summary(1, 'Cũ')]);
    const p = ctrl.reload();
    expect(ctrl.getState().loading).toBe(true);
    await p;
    expect(ctrl.getState()).toMatchObject({ loading: false, loadError: '', items: [{ id: 2 }] });
    await ctrl.reload();
    expect(ctrl.getState()).toMatchObject({ loading: false, loadError: 'Không kết nối được tới máy chủ', items: [{ id: 2 }] });
  });

  it('a silent refresh that fails changes nothing', async () => {
    const { ctrl } = make({ list: vi.fn(async () => { throw new Error('x'); }) }, [summary(1, 'Cũ')]);
    await ctrl.refresh();
    expect(ctrl.getState()).toMatchObject({ items: [{ id: 1 }], loadError: '' });
  });
});

describe('TrainingListController: read records of trainings that are gone (S43)', () => {
  it('deletes the record of every training that is not in the list or has ended, on load and on every refresh', async () => {
    const store = new InMemoryTrainingReadStore();
    for (const id of [1, 2, 3, 4]) store.save(id, { members: { '1': { baselineAt: 1, baselinePromptCount: 0, readPromptCount: 0, turns: {} } } });
    const gateway = { list: vi.fn(async () => [summary(1, 'A'), summary(2, 'B', { status: 'ended' })]) } as unknown as TrainingAdminGateway;
    const ctrl = new TrainingListController(gateway, [summary(1, 'A'), summary(2, 'B'), summary(3, 'C', { status: 'stopped' })], store);
    expect(Object.keys(store.load(1).members)).toHaveLength(1);
    expect(store.load(3).members['1']).toBeDefined(); // a stopped training is not over
    expect(store.load(4)).toEqual({ members: {} }); // not in the list at all
    await ctrl.refresh();
    expect(store.load(2)).toEqual({ members: {} }); // ended since
    expect(store.load(3)).toEqual({ members: {} }); // gone from the list
    expect(store.load(1).members['1']).toBeDefined();
  });
});
