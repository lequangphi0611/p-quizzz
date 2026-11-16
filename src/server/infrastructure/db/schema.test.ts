import { describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createDb } from './client.js';
import { answers, attempts, exams, options, participants, questions, sessions } from './schema.js';
import { seedExam } from './testing/seed-exam.js';

const TABLES = ['answers', 'app_meta', 'attempts', 'exams', 'options', 'participants', 'questions', 'sessions'];

function setup() {
  const db = createDb(':memory:');
  const exam = seedExam(db);
  const session = db.insert(sessions).values({ examId: exam.id, createdAt: new Date() }).returning().get();
  const p = db.insert(participants).values({ sessionId: session.id, displayName: 'Minh Anh', token: 't1', joinedAt: new Date() }).returning().get();
  const attempt = db.insert(attempts).values({ participantId: p.id, attemptNo: 1, questionOrder: [1, 2, 3], optionOrder: { '1': [2, 1] }, startedAt: new Date() }).returning().get();
  return { db, exam, session, p, attempt };
}

describe('schema', () => {
  it('migrate on :memory: creates all tables', () => {
    const db = createDb(':memory:');
    const rows = db.all<{ name: string }>(sql`select name from sqlite_master where type='table' and name not like 'sqlite_%' and name != '__drizzle_migrations'`);
    expect(rows.map(r => r.name).sort()).toEqual(TABLES);
  });

  it('seedExam creates 3 questions and 5 options', () => {
    const db = createDb(':memory:');
    const exam = seedExam(db);
    expect(db.select().from(questions).where(eq(questions.examId, exam.id)).all()).toHaveLength(3);
    expect(db.select().from(options).all()).toHaveLength(5);
  });

  it('rejects duplicate answers(attempt_id, question_id)', () => {
    const { db, attempt } = setup();
    const q = db.select().from(questions).get()!;
    db.insert(answers).values({ attemptId: attempt.id, questionId: q.id }).run();
    expect(() => db.insert(answers).values({ attemptId: attempt.id, questionId: q.id }).run()).toThrow(/UNIQUE/i);
  });

  it('rejects duplicate participant token', () => {
    const { db, session } = setup();
    expect(() => db.insert(participants).values({ sessionId: session.id, displayName: 'Other', token: 't1', joinedAt: new Date() }).run()).toThrow(/UNIQUE/i);
  });

  it('display name is unique per session case-insensitively, unless kicked', () => {
    const { db, session, p } = setup();
    const dup = { sessionId: session.id, displayName: 'MINH ANH', joinedAt: new Date() };
    expect(() => db.insert(participants).values({ ...dup, token: 't2' }).run()).toThrow(/UNIQUE/i);
    db.update(participants).set({ status: 'kicked' }).where(eq(participants.id, p.id)).run();
    expect(() => db.insert(participants).values({ ...dup, token: 't3' }).run()).not.toThrow();
  });

  it('deleting an exam cascades to questions/options but is blocked by sessions', () => {
    const db = createDb(':memory:');
    const a = seedExam(db);
    db.delete(exams).where(eq(exams.id, a.id)).run();
    expect(db.select().from(questions).all()).toHaveLength(0);
    expect(db.select().from(options).all()).toHaveLength(0);

    const { db: db2, exam } = setup();
    expect(() => db2.delete(exams).where(eq(exams.id, exam.id)).run()).toThrow(/FOREIGN KEY/i);
  });

  it('stores JSON columns with their types and scores as real', () => {
    const { db, attempt } = setup();
    db.update(attempts).set({ autoScore: 2.5 }).where(eq(attempts.id, attempt.id)).run();
    const row = db.select().from(attempts).get()!;
    expect(row.questionOrder).toEqual([1, 2, 3]);
    expect(row.optionOrder).toEqual({ '1': [2, 1] });
    expect(row.autoScore).toBe(2.5);
  });

  it('migrate is idempotent on a file DB', async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const file = join(mkdtempSync(join(tmpdir(), 'pq-')), 'x.db');
    createDb(file);
    expect(() => createDb(file)).not.toThrow();
  });
});
