import { and, eq, inArray } from 'drizzle-orm';
import type { AiSuggestionRepository } from '../../application/ports/ai-suggestion-repository.js';
import type { AiSuggestion, AiUse, RawSuggestion } from '../../domain/grading/ai-suggestion.js';
import type { DbAccess } from './drizzle-exam-repository.js';
import { aiSuggestions, answers, attempts, participants } from './schema.js';

const EMPTY = { score: null, feedback: null, criteria: null, suspicious: false, suspiciousReason: null, suspiciousLines: null, error: null, model: null, used: null, finishedAt: null };

export class DrizzleAiSuggestionRepository implements AiSuggestionRepository {
  constructor(private readonly access: DbAccess) {}

  async findById(id: number): Promise<AiSuggestion | null> {
    return (await this.access(db => db.select().from(aiSuggestions).where(eq(aiSuggestions.id, id)).get())) ?? null;
  }

  listByAnswerIds(answerIds: number[]): Promise<AiSuggestion[]> {
    if (answerIds.length === 0) return Promise.resolve([]);
    return this.access(db => db.select().from(aiSuggestions).where(inArray(aiSuggestions.answerId, answerIds)).all());
  }

  async anyDoneInSession(sessionId: number): Promise<boolean> {
    const row = await this.access(db =>
      db
        .select({ id: aiSuggestions.id })
        .from(aiSuggestions)
        .innerJoin(answers, eq(aiSuggestions.answerId, answers.id))
        .innerJoin(attempts, eq(answers.attemptId, attempts.id))
        .innerJoin(participants, eq(attempts.participantId, participants.id))
        .where(and(eq(participants.sessionId, sessionId), eq(aiSuggestions.status, 'done')))
        .limit(1)
        .get(),
    );
    return !!row;
  }

  queue(answerIds: number[], requestedAt: Date): Promise<number[]> {
    return this.access(db =>
      answerIds.map(
        answerId =>
          db
            .insert(aiSuggestions)
            .values({ answerId, status: 'queued', requestedAt, ...EMPTY })
            .onConflictDoUpdate({ target: aiSuggestions.answerId, set: { status: 'queued', requestedAt, ...EMPTY } })
            .returning({ id: aiSuggestions.id })
            .get().id,
      ),
    );
  }

  async markRunning(id: number): Promise<void> {
    await this.access(db => db.update(aiSuggestions).set({ status: 'running' }).where(eq(aiSuggestions.id, id)).run());
  }

  async complete(id: number, s: RawSuggestion, finishedAt: Date): Promise<void> {
    await this.access(db =>
      db
        .update(aiSuggestions)
        .set({ status: 'done', score: s.score, feedback: s.feedback, criteria: s.criteria, suspicious: s.suspicious, suspiciousReason: s.suspiciousReason, suspiciousLines: s.suspiciousLines, model: s.model, error: null, finishedAt })
        .where(eq(aiSuggestions.id, id))
        .run(),
    );
  }

  async fail(id: number, error: string, finishedAt: Date): Promise<void> {
    await this.access(db => db.update(aiSuggestions).set({ status: 'failed', error, finishedAt }).where(eq(aiSuggestions.id, id)).run());
  }

  async removeQueued(answerIds: number[]): Promise<number> {
    if (answerIds.length === 0) return 0;
    return this.access(db => db.delete(aiSuggestions).where(and(inArray(aiSuggestions.answerId, answerIds), eq(aiSuggestions.status, 'queued'))).run().changes);
  }

  async remove(id: number): Promise<void> {
    await this.access(db => db.delete(aiSuggestions).where(eq(aiSuggestions.id, id)).run());
  }

  async setUsed(answerId: number, used: AiUse | null): Promise<void> {
    await this.access(db => db.update(aiSuggestions).set({ used }).where(eq(aiSuggestions.answerId, answerId)).run());
  }

  failUnfinished(error: string, at: Date): Promise<number> {
    return this.access(db => db.update(aiSuggestions).set({ status: 'failed', error, finishedAt: at }).where(inArray(aiSuggestions.status, ['queued', 'running'])).run().changes);
  }
}
