import { beforeEach, describe, expect, it } from 'vitest';
import { EmptyEmailListError, GroupNameTakenError, GroupNotFoundError, InvalidEmailsError } from '../../../domain/group/errors.js';
import { FakeClock } from '../../testing/fakes.js';
import { InMemoryGroupRepository } from '../../testing/in-memory-group-repository.js';
import { InMemoryUnitOfWork } from '../../testing/in-memory-unit-of-work.js';
import { CreateGroup, DeleteGroup, GetGroup, ListGroups, UpdateGroup } from './groups.js';

let repo: InMemoryGroupRepository;
let clock: FakeClock;
const build = () => {
  const unitOfWork = new InMemoryUnitOfWork({ groups: repo }, [repo]);
  const deps = { unitOfWork, groups: repo, clock };
  return { create: new CreateGroup(deps), update: new UpdateGroup(deps), remove: new DeleteGroup(unitOfWork), list: new ListGroups(repo), get: new GetGroup(repo) };
};
beforeEach(() => { repo = new InMemoryGroupRepository(); clock = new FakeClock(1000); });

describe('groups', () => {
  it('creates a group: emails normalized and de-duplicated, order kept', async () => {
    const g = await build().create.execute({ name: '#member-0908', emails: ['Philq@Gmail.com', 'phiabc@gmail.com', 'philq@gmail.com'] });
    expect(g).toMatchObject({ name: '#member-0908', emailCount: 2, emails: ['philq@gmail.com', 'phiabc@gmail.com'] });
  });

  it('refuses a bad email (naming it) or an empty list, and keeps nothing', async () => {
    const uc = build();
    await expect(uc.create.execute({ name: 'A', emails: ['ok@x.com', 'phi89@'] })).rejects.toBeInstanceOf(InvalidEmailsError);
    await expect(uc.create.execute({ name: 'A', emails: [] })).rejects.toBeInstanceOf(EmptyEmailListError);
    expect(await uc.list.execute()).toEqual([]);
  });

  it('names are unique, ignoring case and surrounding spaces; renaming to your own name is fine', async () => {
    const uc = build();
    const a = await uc.create.execute({ name: 'Lớp A', emails: ['a@x.com'] });
    await expect(uc.create.execute({ name: ' lớp a ', emails: ['b@x.com'] })).rejects.toBeInstanceOf(GroupNameTakenError);
    await uc.create.execute({ name: 'Lớp B', emails: ['b@x.com'] });
    await expect(uc.update.execute(a.id, { name: 'LỚP B', emails: ['a@x.com'] })).rejects.toBeInstanceOf(GroupNameTakenError);
    expect((await uc.update.execute(a.id, { name: 'Lớp A', emails: ['a@x.com', 'c@x.com'] })).emailCount).toBe(2);
  });

  it('updates name and emails (replacing the list), then deletes; unknown ids are not found', async () => {
    const uc = build();
    const g = await uc.create.execute({ name: 'X', emails: ['a@x.com'] });
    clock.advance(5);
    const u = await uc.update.execute(g.id, { name: 'Y', emails: ['b@x.com'] });
    expect(u).toMatchObject({ name: 'Y', emails: ['b@x.com'] });
    expect(u.updatedAt.getTime()).toBeGreaterThan(u.createdAt.getTime());
    await uc.remove.execute(g.id);
    await expect(uc.get.execute(g.id)).rejects.toBeInstanceOf(GroupNotFoundError);
    await expect(uc.update.execute(g.id, { name: 'Y', emails: ['b@x.com'] })).rejects.toBeInstanceOf(GroupNotFoundError);
    await expect(uc.remove.execute(g.id)).rejects.toBeInstanceOf(GroupNotFoundError);
  });
});
