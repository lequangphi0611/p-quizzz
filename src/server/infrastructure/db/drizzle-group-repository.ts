import { asc, desc, eq, sql } from 'drizzle-orm';
import type { GroupDetailView, GroupReader, GroupRepository, GroupSummaryView } from '../../application/ports/group-repository.js';
import type { DbAccess } from './drizzle-exam-repository.js';
import { groupEmails, groups } from './schema.js';

type Db = Parameters<Parameters<DbAccess>[0]>[0];

const summaryRows = (db: Db) =>
  db
    .select({
      id: groups.id,
      name: groups.name,
      createdAt: groups.createdAt,
      updatedAt: groups.updatedAt,
      emailCount: sql<number>`(select count(*) from group_emails where group_emails.group_id = groups.id)`,
      lastUsedAt: sql<number | null>`(select max(sessions.created_at) from sessions where sessions.source_group_id = groups.id)`,
    })
    .from(groups);

// `lastUsedAt` comes back as raw epoch ms from the subquery (no column mapping): turn it into a Date here.
const toSummary = (r: { id: number; name: string; createdAt: Date; updatedAt: Date; emailCount: number; lastUsedAt: number | null }): GroupSummaryView => ({
  id: r.id, name: r.name, createdAt: r.createdAt, updatedAt: r.updatedAt, emailCount: Number(r.emailCount), lastUsedAt: r.lastUsedAt === null ? null : new Date(Number(r.lastUsedAt)),
});

export class DrizzleGroupRepository implements GroupRepository, GroupReader {
  constructor(private readonly access: DbAccess) {}

  async list(): Promise<GroupSummaryView[]> {
    return (await this.access(db => summaryRows(db).orderBy(desc(groups.updatedAt), desc(groups.id)).all())).map(toSummary);
  }

  async find(id: number): Promise<GroupDetailView | null> {
    return this.access(db => {
      const row = summaryRows(db).where(eq(groups.id, id)).get();
      if (!row) return null;
      const emails = db.select({ email: groupEmails.email }).from(groupEmails).where(eq(groupEmails.groupId, id)).orderBy(asc(groupEmails.position)).all().map(r => r.email);
      return { ...toSummary(row), emails };
    });
  }

  create(input: { name: string; emails: string[]; now: Date }): Promise<number> {
    return this.access(db => {
      const id = db.insert(groups).values({ name: input.name, createdAt: input.now, updatedAt: input.now }).returning({ id: groups.id }).get().id;
      input.emails.forEach((email, position) => db.insert(groupEmails).values({ groupId: id, email, position }).run());
      return id;
    });
  }

  replace(id: number, input: { name: string; emails: string[]; now: Date }): Promise<boolean> {
    return this.access(db => {
      const found = db.update(groups).set({ name: input.name, updatedAt: input.now }).where(eq(groups.id, id)).returning({ id: groups.id }).get();
      if (!found) return false;
      db.delete(groupEmails).where(eq(groupEmails.groupId, id)).run();
      input.emails.forEach((email, position) => db.insert(groupEmails).values({ groupId: id, email, position }).run());
      return true;
    });
  }

  async remove(id: number): Promise<boolean> {
    // group_emails go with it (cascade); sessions keep their own copy and only forget the link (set null).
    return !!(await this.access(db => db.delete(groups).where(eq(groups.id, id)).returning({ id: groups.id }).get()));
  }

  async emailsOf(id: number): Promise<string[] | null> {
    return this.access(db => {
      if (!db.select({ id: groups.id }).from(groups).where(eq(groups.id, id)).get()) return null;
      return db.select({ email: groupEmails.email }).from(groupEmails).where(eq(groupEmails.groupId, id)).orderBy(asc(groupEmails.position)).all().map(r => r.email);
    });
  }

  async names(): Promise<{ id: number; name: string }[]> {
    return this.access(db => db.select({ id: groups.id, name: groups.name }).from(groups).all());
  }
}

