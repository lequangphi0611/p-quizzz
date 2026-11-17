import { cleanEmails } from '../../../domain/group/emails.js';
import { GroupNameTakenError, GroupNotFoundError } from '../../../domain/group/errors.js';
import type { Clock } from '../../ports/clock.js';
import type { GroupDetailView, GroupReader, GroupSummaryView, GroupUnitContext } from '../../ports/group-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

/** Case-insensitive over all of Unicode (the database's lower() only does ASCII). */
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export class ListGroups {
  constructor(private readonly groups: GroupReader) {}
  execute(): Promise<GroupSummaryView[]> { return this.groups.list(); }
}

export class GetGroup {
  constructor(private readonly groups: GroupReader) {}
  async execute(id: number): Promise<GroupDetailView> {
    const g = await this.groups.find(id);
    if (!g) throw new GroupNotFoundError();
    return g;
  }
}

interface Deps { unitOfWork: UnitOfWork<GroupUnitContext>; groups: GroupReader; clock: Clock }

/** Mentor creates a group: a name and the emails of the people it stands for. Emails are normalized and de-duplicated. */
export class CreateGroup {
  constructor(private readonly deps: Deps) {}
  async execute(input: { name: string; emails: readonly string[] }): Promise<GroupDetailView> {
    const emails = cleanEmails(input.emails);
    const id = await this.deps.unitOfWork.run(async ({ groups }) => {
      if ((await groups.names()).some(g => sameName(g.name, input.name))) throw new GroupNameTakenError();
      return groups.create({ name: input.name, emails, now: this.deps.clock.now() });
    });
    return new GetGroup(this.deps.groups).execute(id);
  }
}

/** Replaces a group's name and emails. Sessions already created from it keep their own copy of the list. */
export class UpdateGroup {
  constructor(private readonly deps: Deps) {}
  async execute(id: number, input: { name: string; emails: readonly string[] }): Promise<GroupDetailView> {
    const emails = cleanEmails(input.emails);
    await this.deps.unitOfWork.run(async ({ groups }) => {
      if ((await groups.names()).some(g => g.id !== id && sameName(g.name, input.name))) throw new GroupNameTakenError();
      if (!(await groups.replace(id, { name: input.name, emails, now: this.deps.clock.now() }))) throw new GroupNotFoundError();
    });
    return new GetGroup(this.deps.groups).execute(id);
  }
}

export class DeleteGroup {
  constructor(private readonly unitOfWork: UnitOfWork<GroupUnitContext>) {}
  async execute(id: number): Promise<void> {
    await this.unitOfWork.run(async ({ groups }) => {
      if (!(await groups.remove(id))) throw new GroupNotFoundError();
    });
  }
}
