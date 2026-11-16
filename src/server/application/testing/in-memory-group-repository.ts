import type { GroupDetailView, GroupReader, GroupRepository, GroupSummaryView } from '../ports/group-repository.js';
import type { Snapshottable } from './in-memory-unit-of-work.js';

interface Row { id: number; name: string; emails: string[]; createdAt: Date; updatedAt: Date }

/** Test double for the group ports. */
export class InMemoryGroupRepository implements GroupRepository, GroupReader, Snapshottable {
  private rows = new Map<number, Row>();
  private nextId = 1;

  async create(input: { name: string; emails: string[]; now: Date }) {
    const id = this.nextId++;
    this.rows.set(id, { id, name: input.name, emails: [...input.emails], createdAt: input.now, updatedAt: input.now });
    return id;
  }

  async replace(id: number, input: { name: string; emails: string[]; now: Date }) {
    const row = this.rows.get(id);
    if (!row) return false;
    this.rows.set(id, { ...row, name: input.name, emails: [...input.emails], updatedAt: input.now });
    return true;
  }

  async remove(id: number) {
    return this.rows.delete(id);
  }

  async emailsOf(id: number) {
    const row = this.rows.get(id);
    return row ? [...row.emails] : null;
  }

  async names() {
    return [...this.rows.values()].map(r => ({ id: r.id, name: r.name }));
  }

  async list(): Promise<GroupSummaryView[]> {
    return [...this.rows.values()].map(r => this.summary(r)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id - a.id);
  }

  async find(id: number): Promise<GroupDetailView | null> {
    const r = this.rows.get(id);
    return r ? { ...this.summary(r), emails: [...r.emails] } : null;
  }

  snapshot() {
    return { rows: new Map([...this.rows].map(([k, v]): [number, Row] => [k, { ...v, emails: [...v.emails] }])), nextId: this.nextId };
  }

  restore(snapshot: unknown) {
    const s = snapshot as ReturnType<InMemoryGroupRepository['snapshot']>;
    this.rows = s.rows;
    this.nextId = s.nextId;
  }

  private summary(r: Row): GroupSummaryView {
    return { id: r.id, name: r.name, emailCount: r.emails.length, createdAt: r.createdAt, updatedAt: r.updatedAt, lastUsedAt: null };
  }
}
