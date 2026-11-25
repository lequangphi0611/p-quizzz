import {
  FLAG_TEXT_CHARS, OUTPUT_END_CHARS, type EventDetail, type ExportStats, type LightEvent, type MarkedEvent, type MemberCounts, type NewTrainingEvent, type TrainingEventRepository,
} from '../ports/training-event-repository.js';
import type { ExportEvent } from '../../domain/training/export.js';
import type { FlagEvent } from '../../domain/training/flags/flag-event.js';
import type { EventSkeleton } from '../../domain/training/export-selection.js';
import type { Snapshottable } from './in-memory-unit-of-work.js';
import type { InMemoryTrainingMemberRepository } from './in-memory-training-repository.js';

export type StoredTrainingEvent = NewTrainingEvent & { id: number };

/** Test double: events of a member that was deleted are gone from reads, as the database's cascade would leave them. */
export class InMemoryTrainingEventRepository implements TrainingEventRepository, Snapshottable {
  private rows: StoredTrainingEvent[] = [];
  private nextId = 1;
  private marks = new Set<number>();

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

  private toLight(e: StoredTrainingEvent): LightEvent {
    const tool = e.kind === 'tool' ? e : null;
    const text = tool?.output ? (tool.output.tail ?? tool.output.head) : null;
    const change = e.kind === 'permission' || e.kind === 'tool' ? e.change : null;
    return {
      id: e.id,
      kind: e.kind,
      receivedAt: e.receivedAt,
      claudeSessionId: e.claudeSessionId,
      prompt: e.kind === 'prompt' ? e.prompt : null,
      toolName: e.kind === 'tool' || e.kind === 'permission' ? e.toolName : null,
      toolTarget: e.kind === 'tool' || e.kind === 'permission' ? e.toolTarget : null,
      ok: tool?.ok ?? null,
      durationMs: tool?.durationMs ?? null,
      errorExcerpt: tool?.errorExcerpt ?? null,
      note: e.kind === 'tool' || e.kind === 'session' ? e.note : null,
      subtype: e.kind === 'session' || e.kind === 'notice' ? e.subtype : null,
      permissionMode: e.permissionMode,
      outputEnd: text === null ? null : text.slice(-OUTPUT_END_CHARS),
      hasOutput: Boolean(tool?.output),
      hasChange: Boolean(change),
      marked: this.marks.has(e.id),
    };
  }

  async listLight(memberId: number, afterId: number, limit: number): Promise<LightEvent[]> {
    return (await this.all()).filter(e => e.memberId === memberId && e.id > afterId).slice(0, limit).map(e => this.toLight(e));
  }

  async listMarked(trainingId: number): Promise<MarkedEvent[]> {
    const out: MarkedEvent[] = [];
    for (const e of await this.all()) {
      if (this.marks.has(e.id) && (await this.members.findById(e.memberId))?.trainingId === trainingId) out.push({ ...this.toLight(e), memberId: e.memberId });
    }
    return out;
  }

  async listEventSkeleton(memberId: number): Promise<EventSkeleton[]> {
    return (await this.all()).filter(e => e.memberId === memberId).map(e => ({ id: e.id, kind: e.kind, claudeSessionId: e.claudeSessionId, subtype: e.kind === 'session' || e.kind === 'notice' ? e.subtype : null, receivedAt: e.receivedAt }));
  }

  async listForExportByIds(memberId: number, ids: readonly number[]): Promise<ExportEvent[]> {
    const wanted = new Set(ids);
    return (await this.all())
      .filter(e => e.memberId === memberId && wanted.has(e.id))
      .map(e => ({
        id: e.id,
        kind: e.kind,
        at: e.receivedAt,
        claudeSessionId: e.claudeSessionId,
        permissionMode: e.permissionMode,
        prompt: e.kind === 'prompt' ? e.prompt : null,
        toolName: e.kind === 'tool' || e.kind === 'permission' ? e.toolName : null,
        toolTarget: e.kind === 'tool' || e.kind === 'permission' ? e.toolTarget : null,
        ok: e.kind === 'tool' ? e.ok : null,
        durationMs: e.kind === 'tool' ? e.durationMs : null,
        errorExcerpt: e.kind === 'tool' ? e.errorExcerpt : null,
        note: e.kind === 'tool' || e.kind === 'session' ? e.note : null,
        subtype: e.kind === 'session' || e.kind === 'notice' ? e.subtype : null,
        output: e.kind === 'tool' ? e.output : null,
        change: e.kind === 'tool' || e.kind === 'permission' ? e.change : null,
        marked: this.marks.has(e.id),
      }));
  }

  async exportStats(trainingId: number, range: { from: Date; to: Date }): Promise<Map<number, ExportStats>> {
    const out = new Map<number, ExportStats>();
    for (const e of await this.all()) {
      if ((await this.members.findById(e.memberId))?.trainingId !== trainingId) continue;
      if (e.receivedAt < range.from || e.receivedAt >= range.to) continue;
      const c = out.get(e.memberId) ?? { eventCount: 0, approxBytes: 0 };
      c.eventCount++;
      c.approxBytes += 200 + JSON.stringify(e).length;
      out.set(e.memberId, c);
    }
    return out;
  }

  async setMark(eventId: number, marked: boolean) {
    if (marked) this.marks.add(eventId);
    else this.marks.delete(eventId);
  }

  async listForFlags(memberId: number): Promise<FlagEvent[]> {
    const text = (clip: { head: string; tail: string | null } | null | undefined, from: 'head' | 'both') =>
      clip ? (from === 'head' ? clip.head : `${clip.head.slice(0, FLAG_TEXT_CHARS / 2)}${(clip.tail ?? '').slice(-FLAG_TEXT_CHARS / 2)}`) : null;
    return (await this.all())
      .filter(e => e.memberId === memberId)
      .map(e => ({
        id: e.id,
        kind: e.kind,
        at: e.receivedAt.getTime(),
        claudeSessionId: e.claudeSessionId,
        permissionMode: e.permissionMode,
        prompt: e.kind === 'prompt' ? e.prompt : null,
        toolName: e.kind === 'tool' || e.kind === 'permission' ? e.toolName : null,
        toolTarget: e.kind === 'tool' || e.kind === 'permission' ? e.toolTarget : null,
        ok: e.kind === 'tool' ? e.ok : null,
        durationMs: e.kind === 'tool' ? e.durationMs : null,
        subtype: e.kind === 'session' || e.kind === 'notice' ? e.subtype : null,
        changeText: e.kind === 'tool' || e.kind === 'permission' ? (text(e.change, 'head')?.slice(0, FLAG_TEXT_CHARS) ?? null) : null,
        outputText: e.kind === 'tool' ? text(e.output, 'both') : null,
      }));
  }

  async getDetail(eventId: number): Promise<EventDetail | null> {
    const e = (await this.all()).find(x => x.id === eventId);
    if (!e) return null;
    const member = await this.members.findById(e.memberId);
    return {
      trainingId: member!.trainingId,
      output: e.kind === 'tool' ? e.output : null,
      change: e.kind === 'tool' || e.kind === 'permission' ? e.change : null,
    };
  }

  async countsByMember(trainingId: number): Promise<Map<number, MemberCounts>> {
    const out = new Map<number, MemberCounts>();
    for (const e of await this.all()) {
      if ((await this.members.findById(e.memberId))?.trainingId !== trainingId) continue;
      const c = out.get(e.memberId) ?? { promptCount: 0, toolCount: 0, failedCount: 0, clearCount: 0, compactCount: 0, permissionCount: 0, markedCount: 0, lastEventId: 0 };
      c.lastEventId = Math.max(c.lastEventId, e.id);
      if (this.marks.has(e.id)) c.markedCount++;
      if (e.kind === 'prompt') c.promptCount++;
      else if (e.kind === 'tool') {
        c.toolCount++;
        if (!e.ok) c.failedCount++;
      } else if (e.kind === 'session') {
        if (e.subtype === 'clear') c.clearCount++;
        else if (e.subtype.startsWith('compact')) c.compactCount++;
      } else if (e.kind === 'permission') c.permissionCount++;
      out.set(e.memberId, c);
    }
    return out;
  }

  snapshot() {
    return { rows: [...this.rows], nextId: this.nextId, marks: new Set(this.marks) };
  }

  restore(s: unknown) {
    const snap = s as { rows: StoredTrainingEvent[]; nextId: number; marks: Set<number> };
    this.marks = new Set(snap.marks);
    this.rows = [...snap.rows];
    this.nextId = snap.nextId;
  }
}
