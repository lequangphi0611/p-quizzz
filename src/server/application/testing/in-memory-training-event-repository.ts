import {
  OUTPUT_END_CHARS, type EventDetail, type LightEvent, type MemberCounts, type NewTrainingEvent, type TrainingEventRepository,
} from '../ports/training-event-repository.js';
import type { ToolOutcome } from '../../domain/training/is-stuck.js';
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

  async listLight(memberId: number, afterId: number, limit: number): Promise<LightEvent[]> {
    return (await this.all())
      .filter(e => e.memberId === memberId && e.id > afterId)
      .slice(0, limit)
      .map(e => {
        const tool = e.kind === 'tool' ? e : null;
        const text = tool?.output ? (tool.output.tail ?? tool.output.head) : null;
        return {
          id: e.id,
          kind: e.kind,
          receivedAt: e.receivedAt,
          claudeSessionId: e.claudeSessionId,
          prompt: e.kind === 'prompt' ? e.prompt : null,
          toolName: tool?.toolName ?? null,
          toolTarget: tool?.toolTarget ?? null,
          ok: tool?.ok ?? null,
          durationMs: tool?.durationMs ?? null,
          errorExcerpt: tool?.errorExcerpt ?? null,
          outputEnd: text === null ? null : text.slice(-OUTPUT_END_CHARS),
          hasOutput: Boolean(tool?.output),
          hasChange: Boolean(tool?.change),
        };
      });
  }

  async getDetail(eventId: number): Promise<EventDetail | null> {
    const e = (await this.all()).find(x => x.id === eventId);
    if (!e) return null;
    const member = await this.members.findById(e.memberId);
    return { trainingId: member!.trainingId, output: e.kind === 'tool' ? e.output : null, change: e.kind === 'tool' ? e.change : null };
  }

  async recentTools(memberId: number, n: number): Promise<ToolOutcome[]> {
    const tools = (await this.all()).filter(e => e.memberId === memberId && e.kind === 'tool');
    return tools.slice(-n).map(e => ({ ok: e.kind === 'tool' && e.ok, toolTarget: e.kind === 'tool' ? e.toolTarget : null }));
  }

  async countsByMember(trainingId: number): Promise<Map<number, MemberCounts>> {
    const out = new Map<number, MemberCounts>();
    for (const e of await this.all()) {
      if ((await this.members.findById(e.memberId))?.trainingId !== trainingId) continue;
      const c = out.get(e.memberId) ?? { promptCount: 0, toolCount: 0, failedCount: 0 };
      if (e.kind === 'prompt') c.promptCount++;
      else {
        c.toolCount++;
        if (!e.ok) c.failedCount++;
      }
      out.set(e.memberId, c);
    }
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
