import { and, asc, count, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { Answer, Attempt, NewAttempt } from '../../domain/attempt/attempt.js';
import type { AttemptRepository, MemberRoom, MemberRoomReader } from '../../application/ports/attempt-repository.js';
import { answers, attempts, exams, participants, questions, sessions } from './schema.js';
import type { DbAccess } from './drizzle-exam-repository.js';

export class DrizzleAttemptRepository implements AttemptRepository {
  constructor(private readonly access: DbAccess) {}

  async findById(id: number): Promise<Attempt | null> {
    return (await this.access(db => db.select().from(attempts).where(eq(attempts.id, id)).get())) ?? null;
  }

  async findAnswerById(answerId: number): Promise<Answer | null> {
    return (await this.access(db => db.select().from(answers).where(eq(answers.id, answerId)).get())) ?? null;
  }

  listSubmittedOfActiveMembers(sessionId: number): Promise<Attempt[]> {
    return this.access(db =>
      db
        .select({ attempt: attempts })
        .from(attempts)
        .innerJoin(participants, eq(attempts.participantId, participants.id))
        .where(and(eq(participants.sessionId, sessionId), eq(participants.status, 'active'), isNotNull(attempts.submittedAt)))
        .all()
        .map(r => r.attempt),
    );
  }

  answersOfAttempts(attemptIds: number[]): Promise<Answer[]> {
    if (attemptIds.length === 0) return Promise.resolve([]);
    return this.access(db => db.select().from(answers).where(inArray(answers.attemptId, attemptIds)).all());
  }

  gradeAnswer(answerId: number, grade: { manualScore: number; feedback: string | null; gradedAt: Date }): Promise<Answer> {
    return this.access(db => db.update(answers).set(grade).where(eq(answers.id, answerId)).returning().get());
  }

  async setManualScore(attemptId: number, score: number): Promise<void> {
    await this.access(db => db.update(attempts).set({ manualScore: score }).where(eq(attempts.id, attemptId)).run());
  }

  async findOwned(participantId: number, attemptId: number): Promise<Attempt | null> {
    return (await this.access(db => db.select().from(attempts).where(and(eq(attempts.id, attemptId), eq(attempts.participantId, participantId))).get())) ?? null;
  }

  listByParticipant(participantId: number): Promise<Attempt[]> {
    return this.access(db => db.select().from(attempts).where(eq(attempts.participantId, participantId)).orderBy(asc(attempts.attemptNo)).all());
  }

  answersOf(attemptId: number): Promise<Answer[]> {
    return this.access(db => db.select().from(answers).where(eq(answers.attemptId, attemptId)).all());
  }

  create(a: NewAttempt): Promise<Attempt> {
    return this.access(db => db.insert(attempts).values(a).returning().get());
  }

  listOpenOfActiveMembers(sessionId: number): Promise<Attempt[]> {
    return this.access(db =>
      db
        .select({ attempt: attempts })
        .from(attempts)
        .innerJoin(participants, eq(attempts.participantId, participants.id))
        .where(and(eq(participants.sessionId, sessionId), isNull(attempts.submittedAt), eq(participants.status, 'active')))
        .all()
        .map(r => r.attempt),
    );
  }

  async markSubmitted(id: number, submittedAt: Date, autoScore: number): Promise<void> {
    await this.access(db => db.update(attempts).set({ submittedAt, autoScore }).where(eq(attempts.id, id)).run());
  }

  async saveAnswer(attemptId: number, questionId: number, value: { selectedOptionIds?: number[]; textAnswer?: string }): Promise<void> {
    await this.access(db =>
      db
        .insert(answers)
        .values({ attemptId, questionId, ...value })
        .onConflictDoUpdate({ target: [answers.attemptId, answers.questionId], set: value })
        .run(),
    );
  }

  async recordAutoScores(attemptId: number, scores: { questionId: number; autoScore: number | null }[]): Promise<void> {
    await this.access(db => {
      const saved = new Map(db.select().from(answers).where(eq(answers.attemptId, attemptId)).all().map(a => [a.questionId, a]));
      for (const { questionId, autoScore } of scores) {
        const existing = saved.get(questionId);
        if (existing) db.update(answers).set({ autoScore }).where(eq(answers.id, existing.id)).run();
        else db.insert(answers).values({ attemptId, questionId, autoScore }).run();
      }
    });
  }
}

/** The three small queries behind the room block of `GET /api/me`. */
export class DrizzleMemberRoomReader implements MemberRoomReader {
  constructor(private readonly access: DbAccess) {}

  async find(sessionId: number): Promise<MemberRoom | null> {
    return this.access(db => {
      const s = db
        .select({ id: sessions.id, title: exams.title, status: sessions.status, totalPoints: exams.totalPoints, hasEssay: exams.hasEssay, examId: exams.id })
        .from(sessions)
        .innerJoin(exams, eq(sessions.examId, exams.id))
        .where(eq(sessions.id, sessionId))
        .get();
      if (!s) return null;
      const { n } = db.select({ n: count() }).from(participants).where(and(eq(participants.sessionId, sessionId), eq(participants.status, 'active'))).get()!;
      const { q } = db.select({ q: count() }).from(questions).where(eq(questions.examId, s.examId)).get()!;
      const { examId: _examId, ...room } = s;
      return { ...room, participantCount: n, questionCount: q };
    });
  }
}
