import { and, asc, eq, gt, gte, inArray, lt, sql } from 'drizzle-orm';
import {
  FLAG_TEXT_CHARS, OUTPUT_END_CHARS, type EventDetail, type ExportStats, type LightEvent, type MarkedEvent, type MemberCounts, type NewTrainingEvent, type TrainingEventRepository,
} from '../../application/ports/training-event-repository.js';
import type { ExportEvent } from '../../domain/training/export.js';
import type { FlagEvent } from '../../domain/training/flags/flag-event.js';
import type { Clip } from '../../domain/training/clip.js';
import type { EventSkeleton } from '../../domain/training/export-selection.js';
import type { DbAccess } from './drizzle-exam-repository.js';
import { trainingEventMarks, trainingEvents, trainingMembers } from './schema.js';

/** Ids per query when the export reads events by id. */
const EXPORT_ID_CHUNK = 500;

const clipOf = (head: string | null, tail: string | null, omitted: number | null): Clip | null => (head === null ? null : { head, tail, omittedLines: omitted ?? 0 });

const LIGHT_COLUMNS = {
  id: trainingEvents.id,
  kind: trainingEvents.kind,
  receivedAt: trainingEvents.receivedAt,
  claudeSessionId: trainingEvents.claudeSessionId,
  prompt: trainingEvents.prompt,
  toolName: trainingEvents.toolName,
  toolTarget: trainingEvents.toolTarget,
  ok: trainingEvents.ok,
  durationMs: trainingEvents.durationMs,
  errorExcerpt: trainingEvents.errorExcerpt,
  note: trainingEvents.note,
  subtype: trainingEvents.subtype,
  permissionMode: trainingEvents.permissionMode,
  outputEnd: sql<string | null>`substr(coalesce(${trainingEvents.outputTail}, ${trainingEvents.outputHead}), ${-OUTPUT_END_CHARS})`,
  hasOutput: sql<number>`${trainingEvents.outputHead} is not null`,
  hasChange: sql<number>`${trainingEvents.changeHead} is not null`,
  marked: sql<number>`exists (select 1 from ${trainingEventMarks} where ${trainingEventMarks.eventId} = ${trainingEvents.id})`,
};

const toLight = (r: { kind: string; hasOutput: number; hasChange: number; marked: number } & Omit<LightEvent, 'kind' | 'hasOutput' | 'hasChange' | 'marked'>): LightEvent => ({
  ...r,
  kind: r.kind as LightEvent['kind'],
  hasOutput: Boolean(r.hasOutput),
  hasChange: Boolean(r.hasChange),
  marked: Boolean(r.marked),
});

export class DrizzleTrainingEventRepository implements TrainingEventRepository {
  constructor(private readonly access: DbAccess) {}

  async append(event: NewTrainingEvent): Promise<void> {
    const common = {
      memberId: event.memberId,
      claudeSessionId: event.claudeSessionId,
      receivedAt: event.receivedAt,
      permissionMode: event.permissionMode,
      promptId: event.promptId,
    };
    const clips = (output: Clip | null, change: Clip | null) => ({
      outputHead: output?.head ?? null,
      outputTail: output?.tail ?? null,
      outputOmittedLines: output?.omittedLines ?? null,
      changeHead: change?.head ?? null,
      changeTail: change?.tail ?? null,
      changeOmittedLines: change?.omittedLines ?? null,
    });
    const row =
      event.kind === 'prompt'
        ? { ...common, kind: 'prompt' as const, prompt: event.prompt }
        : event.kind === 'tool'
          ? {
              ...common,
              kind: 'tool' as const,
              toolName: event.toolName,
              toolTarget: event.toolTarget,
              ok: event.ok,
              durationMs: event.durationMs,
              errorExcerpt: event.errorExcerpt,
              note: event.note,
              ...clips(event.output, event.change),
            }
          : event.kind === 'permission'
            ? { ...common, kind: 'permission' as const, toolName: event.toolName, toolTarget: event.toolTarget, ...clips(null, event.change) }
            : event.kind === 'session'
              ? { ...common, kind: 'session' as const, subtype: event.subtype, note: event.note }
              : { ...common, kind: 'notice' as const, subtype: event.subtype };
    await this.access(db => db.insert(trainingEvents).values(row).run());
  }

  /** Never selects `output_*` / `change_*` whole: only a bounded suffix of the output (for the summary) and whether each exists. */
  listLight(memberId: number, afterId: number, limit: number): Promise<LightEvent[]> {
    return this.access(db =>
      db
        .select(LIGHT_COLUMNS)
        .from(trainingEvents)
        .where(and(eq(trainingEvents.memberId, memberId), gt(trainingEvents.id, afterId)))
        .orderBy(asc(trainingEvents.id))
        .limit(limit)
        .all()
        .map(toLight),
    );
  }

  listMarked(trainingId: number): Promise<MarkedEvent[]> {
    return this.access(db =>
      db
        .select({ ...LIGHT_COLUMNS, memberId: trainingEvents.memberId })
        .from(trainingEvents)
        .innerJoin(trainingEventMarks, eq(trainingEventMarks.eventId, trainingEvents.id))
        .innerJoin(trainingMembers, eq(trainingMembers.id, trainingEvents.memberId))
        .where(eq(trainingMembers.trainingId, trainingId))
        .orderBy(asc(trainingEvents.id))
        .all()
        .map(r => ({ ...toLight(r), memberId: r.memberId })),
    );
  }

  listEventSkeleton(memberId: number): Promise<EventSkeleton[]> {
    return this.access(db =>
      db
        .select({ id: trainingEvents.id, kind: trainingEvents.kind, claudeSessionId: trainingEvents.claudeSessionId, subtype: trainingEvents.subtype, receivedAt: trainingEvents.receivedAt })
        .from(trainingEvents)
        .where(eq(trainingEvents.memberId, memberId))
        .orderBy(asc(trainingEvents.id))
        .all()
        .map(r => ({ ...r, kind: r.kind as EventSkeleton['kind'] })),
    );
  }

  /** Whole text of these events, one member at a time (S41): the export reads what the mentor's screen never loads in a list. Ids go to SQLite in chunks (its variable limit). */
  async listForExportByIds(memberId: number, ids: readonly number[]): Promise<ExportEvent[]> {
    const out: ExportEvent[] = [];
    for (let i = 0; i < ids.length; i += EXPORT_ID_CHUNK) out.push(...(await this.exportChunk(memberId, ids.slice(i, i + EXPORT_ID_CHUNK))));
    return out;
  }

  private exportChunk(memberId: number, ids: readonly number[]): Promise<ExportEvent[]> {
    return this.access(db =>
      db
        .select({
          id: trainingEvents.id,
          kind: trainingEvents.kind,
          at: trainingEvents.receivedAt,
          claudeSessionId: trainingEvents.claudeSessionId,
          permissionMode: trainingEvents.permissionMode,
          prompt: trainingEvents.prompt,
          toolName: trainingEvents.toolName,
          toolTarget: trainingEvents.toolTarget,
          ok: trainingEvents.ok,
          durationMs: trainingEvents.durationMs,
          errorExcerpt: trainingEvents.errorExcerpt,
          note: trainingEvents.note,
          subtype: trainingEvents.subtype,
          outputHead: trainingEvents.outputHead,
          outputTail: trainingEvents.outputTail,
          outputOmitted: trainingEvents.outputOmittedLines,
          changeHead: trainingEvents.changeHead,
          changeTail: trainingEvents.changeTail,
          changeOmitted: trainingEvents.changeOmittedLines,
          marked: sql<number>`exists (select 1 from ${trainingEventMarks} where ${trainingEventMarks.eventId} = ${trainingEvents.id})`,
        })
        .from(trainingEvents)
        .where(and(eq(trainingEvents.memberId, memberId), inArray(trainingEvents.id, [...ids])))
        .orderBy(asc(trainingEvents.id))
        .all()
        .map(({ outputHead, outputTail, outputOmitted, changeHead, changeTail, changeOmitted, marked, ...r }) => ({
          ...r,
          kind: r.kind as ExportEvent['kind'],
          output: clipOf(outputHead, outputTail, outputOmitted),
          change: clipOf(changeHead, changeTail, changeOmitted),
          marked: Boolean(marked),
        })),
    );
  }

  async exportStats(trainingId: number, range: { from: Date; to: Date }): Promise<Map<number, ExportStats>> {
    const bytes = (col: unknown) => sql`coalesce(length(cast(${col} as blob)), 0)`;
    const rows = await this.access(db =>
      db
        .select({
          memberId: trainingEvents.memberId,
          eventCount: sql<number>`count(*)`,
          approxBytes: sql<number>`sum(200 + ${bytes(trainingEvents.prompt)} + ${bytes(trainingEvents.toolTarget)} + ${bytes(trainingEvents.errorExcerpt)} + ${bytes(trainingEvents.note)} + ${bytes(trainingEvents.outputHead)} + ${bytes(trainingEvents.outputTail)} + ${bytes(trainingEvents.changeHead)} + ${bytes(trainingEvents.changeTail)})`,
        })
        .from(trainingEvents)
        .innerJoin(trainingMembers, eq(trainingMembers.id, trainingEvents.memberId))
        .where(and(eq(trainingMembers.trainingId, trainingId), gte(trainingEvents.receivedAt, range.from), lt(trainingEvents.receivedAt, range.to)))
        .groupBy(trainingEvents.memberId)
        .all(),
    );
    return new Map(rows.map(r => [r.memberId, { eventCount: Number(r.eventCount), approxBytes: Number(r.approxBytes) }]));
  }

  async setMark(eventId: number, marked: boolean): Promise<void> {
    await this.access(db =>
      marked
        ? db.insert(trainingEventMarks).values({ eventId }).onConflictDoNothing().run()
        : db.delete(trainingEventMarks).where(eq(trainingEventMarks.eventId, eventId)).run(),
    );
  }

  /** One query per member; the text columns are cut in SQL so a long output never travels whole. */
  listForFlags(memberId: number): Promise<FlagEvent[]> {
    return this.access(db =>
      db
        .select({
          id: trainingEvents.id,
          kind: trainingEvents.kind,
          at: trainingEvents.receivedAt,
          claudeSessionId: trainingEvents.claudeSessionId,
          permissionMode: trainingEvents.permissionMode,
          prompt: trainingEvents.prompt,
          toolName: trainingEvents.toolName,
          toolTarget: trainingEvents.toolTarget,
          ok: trainingEvents.ok,
          durationMs: trainingEvents.durationMs,
          subtype: trainingEvents.subtype,
          changeText: sql<string | null>`substr(${trainingEvents.changeHead}, 1, ${FLAG_TEXT_CHARS})`,
          outputText: sql<string | null>`substr(${trainingEvents.outputHead}, 1, ${FLAG_TEXT_CHARS / 2}) || substr(coalesce(${trainingEvents.outputTail}, ''), ${-FLAG_TEXT_CHARS / 2})`,
        })
        .from(trainingEvents)
        .where(eq(trainingEvents.memberId, memberId))
        .orderBy(asc(trainingEvents.id))
        .all()
        .map(r => ({ ...r, kind: r.kind as FlagEvent['kind'], at: r.at.getTime() })),
    );
  }

  async getDetail(eventId: number): Promise<EventDetail | null> {
    const row = await this.access(db =>
      db
        .select({
          trainingId: trainingMembers.trainingId,
          outputHead: trainingEvents.outputHead,
          outputTail: trainingEvents.outputTail,
          outputOmitted: trainingEvents.outputOmittedLines,
          changeHead: trainingEvents.changeHead,
          changeTail: trainingEvents.changeTail,
          changeOmitted: trainingEvents.changeOmittedLines,
        })
        .from(trainingEvents)
        .innerJoin(trainingMembers, eq(trainingMembers.id, trainingEvents.memberId))
        .where(eq(trainingEvents.id, eventId))
        .get(),
    );
    if (!row) return null;
    return {
      trainingId: row.trainingId,
      output: clipOf(row.outputHead, row.outputTail, row.outputOmitted),
      change: clipOf(row.changeHead, row.changeTail, row.changeOmitted),
    };
  }

  async countsByMember(trainingId: number): Promise<Map<number, MemberCounts>> {
    const rows = await this.access(db =>
      db
        .select({
          memberId: trainingEvents.memberId,
          promptCount: sql<number>`sum(${trainingEvents.kind} = 'prompt')`,
          toolCount: sql<number>`sum(${trainingEvents.kind} = 'tool')`,
          failedCount: sql<number>`sum(${trainingEvents.kind} = 'tool' and ${trainingEvents.ok} = 0)`,
          clearCount: sql<number>`sum(${trainingEvents.kind} = 'session' and ${trainingEvents.subtype} = 'clear')`,
          compactCount: sql<number>`sum(${trainingEvents.kind} = 'session' and ${trainingEvents.subtype} like 'compact%')`,
          permissionCount: sql<number>`sum(${trainingEvents.kind} = 'permission')`,
          markedCount: sql<number>`sum(exists (select 1 from ${trainingEventMarks} where ${trainingEventMarks.eventId} = ${trainingEvents.id}))`,
          lastEventId: sql<number>`max(${trainingEvents.id})`,
        })
        .from(trainingEvents)
        .innerJoin(trainingMembers, eq(trainingMembers.id, trainingEvents.memberId))
        .where(eq(trainingMembers.trainingId, trainingId))
        .groupBy(trainingEvents.memberId)
        .all(),
    );
    return new Map(
      rows.map(r => [
        r.memberId,
        {
          promptCount: Number(r.promptCount), toolCount: Number(r.toolCount), failedCount: Number(r.failedCount),
          clearCount: Number(r.clearCount), compactCount: Number(r.compactCount), permissionCount: Number(r.permissionCount), markedCount: Number(r.markedCount), lastEventId: Number(r.lastEventId),
        },
      ]),
    );
  }
}
