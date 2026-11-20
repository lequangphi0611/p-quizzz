import type { NewTrainingEvent, TrainingEventRepository } from '../ports/training-event-repository.js';
import type { Snapshottable } from './in-memory-unit-of-work.js';
import type { InMemoryTrainingMemberRepository } from './in-memory-training-repository.js';

export type StoredTrainingEvent = NewTrainingEvent & { id: number };

/** Test double: events of a member that was deleted are gone from reads, as the database's cascade would leave them. */
export class InMemoryTrainingEventRepository implements TrainingEventRepository, Snapshottable {
  private rows: StoredTrainingEvent[] = [];
  private nextId = 1;

  constructor(private readonly members: InMemoryTrainingMemberRepository) {}

  async append(event: NewTrainingEvent) {
    this.rows.push({ ...event, id: this.nextId++ });
  }

  /** Test helper: what is stored, oldest first. */
  async all(): Promise<StoredTrainingEvent[]> {
    const out: StoredTrainingEvent[] = [];
    for (const row of this.rows) if (await this.members.findById(row.memberId)) out.push(row);
    return out;
  }

  snapshot() {
    return { rows: [...this.rows], nextId: this.nextId };
  }

  restore(s: unknown) {
    const snap = s as { rows: StoredTrainingEvent[]; nextId: number };
    this.rows = [...snap.rows];
    this.nextId = snap.nextId;
  }
}
