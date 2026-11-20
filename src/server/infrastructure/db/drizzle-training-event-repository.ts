import { and, asc, desc, eq, gt, sql } from 'drizzle-orm';
import {
  OUTPUT_END_CHARS, type EventDetail, type LightEvent, type MemberCounts, type NewTrainingEvent, type TrainingEventRepository,
} from '../../application/ports/training-event-repository.js';
import type { Clip } from '../../domain/training/clip.js';
import type { ToolOutcome } from '../../domain/training/is-stuck.js';
import type { DbAccess } from './drizzle-exam-repository.js';
import { trainingEvents, trainingMembers } from './schema.js';

const clipOf = (head: string | null, tail: string | null, omitted: number | null): Clip | null => (head === null ? null : { head, tail, omittedLines: omitted ?? 0 });

export class DrizzleTrainingEventRepository implements TrainingEventRepository {
  constructor(private readonly access: DbAccess) {}

  async append(event: NewTrainingEvent): Promise<void> {
    const common = { memberId: event.memberId, claudeSessionId: event.claudeSessionId, receivedAt: event.receivedAt };
    const row =
      event.kind === 'prompt'
        ? { ...common, kind: 'prompt' as const, prompt: event.prompt }
        : {
            ...common,
            kind: 'tool' as const,
            toolName: event.toolName,
            toolTarget: event.toolTarget,
            ok: event.ok,
            durationMs: event.durationMs,
            errorExcerpt: event.errorExcerpt,
            outputHead: event.output?.head ?? null,
            outputTail: event.output?.tail ?? null,
            outputOmittedLines: event.output?.omittedLines ?? null,
            changeHead: event.change?.head ?? null,
            changeTail: event.change?.tail ?? null,
            changeOmittedLines: event.change?.omittedLines ?? null,
          };
    await this.access(db => db.insert(trainingEvents).values(row).run());
  }

  /** Never selects `output_*` / `change_*` whole: only a bounded suffix of the output (for the summary) and whether each exists. */
  listLight(memberId: number, afterId: number, limit: number): Promise<LightEvent[]> {
    return this.access(db =>
      db
        .select({
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
          outputEnd: sql<string | null>`substr(coalesce(${trainingEvents.outputTail}, ${trainingEvents.outputHead}), ${-OUTPUT_END_CHARS})`,
          hasOutput: sql<number>`${trainingEvents.outputHead} is not null`,
          hasChange: sql<number>`${trainingEvents.changeHead} is not null`,
        })
        .from(trainingEvents)
        .where(and(eq(trainingEvents.memberId, memberId), gt(trainingEvents.id, afterId)))
        .orderBy(asc(trainingEvents.id))
        .limit(limit)
        .all()
        .map(r => ({ ...r, hasOutput: Boolean(r.hasOutput), hasChange: Boolean(r.hasChange) })),
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

  async recentTools(memberId: number, n: number): Promise<ToolOutcome[]> {
    const rows = await this.access(db =>
      db
        .select({ ok: trainingEvents.ok, toolTarget: trainingEvents.toolTarget })
        .from(trainingEvents)
        .where(and(eq(trainingEvents.memberId, memberId), eq(trainingEvents.kind, 'tool')))
        .orderBy(desc(trainingEvents.id))
        .limit(n)
        .all(),
    );
    return rows.reverse().map(r => ({ ok: r.ok === true, toolTarget: r.toolTarget }));
  }

  async countsByMember(trainingId: number): Promise<Map<number, MemberCounts>> {
    const rows = await this.access(db =>
      db
        .select({
          memberId: trainingEvents.memberId,
          promptCount: sql<number>`sum(${trainingEvents.kind} = 'prompt')`,
          toolCount: sql<number>`sum(${trainingEvents.kind} = 'tool')`,
          failedCount: sql<number>`sum(${trainingEvents.kind} = 'tool' and ${trainingEvents.ok} = 0)`,
        })
        .from(trainingEvents)
        .innerJoin(trainingMembers, eq(trainingMembers.id, trainingEvents.memberId))
        .where(eq(trainingMembers.trainingId, trainingId))
        .groupBy(trainingEvents.memberId)
        .all(),
    );
    return new Map(rows.map(r => [r.memberId, { promptCount: Number(r.promptCount), toolCount: Number(r.toolCount), failedCount: Number(r.failedCount) }]));
  }
}
