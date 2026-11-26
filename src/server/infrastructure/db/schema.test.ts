import { describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createDb } from './client.js';
import { answers, attempts, exams, options, participants, questions, sessions } from './schema.js';
import { seedExam } from './testing/seed-exam.js';

const TABLES = ['ai_suggestions', 'answers', 'app_meta', 'attempts', 'exams', 'group_emails', 'groups', 'options', 'participants', 'questions', 'rejoin_requests', 'session_roster', 'sessions', 'training_event_marks', 'training_events', 'training_example_drafts', 'training_members', 'training_teaching_examples', 'trainings'];

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
  it('migration 0018 marks training members that already existed as agreed to teaching examples; new rows default to false', async () => {
    const { mkdtempSync, cpSync, readFileSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const Database = (await import('better-sqlite3')).default;
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
    const full = fileURLToPath(new URL('./migrations', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'pq-mig-'));
    const partial = join(dir, 'before');
    cpSync(full, partial, { recursive: true });
    const journalFile = join(partial, 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalFile, 'utf8')) as { entries: { tag: string }[] };
    journal.entries = journal.entries.filter(e => Number(e.tag.slice(0, 4)) < 18);
    writeFileSync(journalFile, JSON.stringify(journal));

    const sqlite = new Database(join(dir, 'x.db'));
    sqlite.pragma('foreign_keys = ON');
    const raw = drizzle(sqlite);
    migrate(raw, { migrationsFolder: partial }); // the database as it was before S44
    const now = Date.now();
    sqlite.prepare('insert into trainings (name, created_at) values (?, ?)').run('Cũ', now);
    sqlite
      .prepare('insert into training_members (training_id, display_name, token, ingest_token, consented_at) values (1, ?, ?, ?, ?)')
      .run('Cũ', 't-old', 'i-old', now);
    migrate(raw, { migrationsFolder: full });
    sqlite
      .prepare('insert into training_members (training_id, display_name, token, ingest_token, consented_at) values (1, ?, ?, ?, ?)')
      .run('Mới', 't-new', 'i-new', now);
    const rows = sqlite.prepare('select display_name as n, teaching_consent as c from training_members order by id').all();
    sqlite.close();
    expect(rows).toEqual([{ n: 'Cũ', c: 1 }, { n: 'Mới', c: 0 }]);
  });
  it('migration 0021 keeps the examples that already existed as the mentor’s own (no AI draft), and drafts go with their event', async () => {
    const { mkdtempSync, cpSync, readFileSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const Database = (await import('better-sqlite3')).default;
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
    const full = fileURLToPath(new URL('./migrations', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'pq-mig-'));
    const partial = join(dir, 'before');
    cpSync(full, partial, { recursive: true });
    const journalFile = join(partial, 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalFile, 'utf8')) as { entries: { tag: string }[] };
    journal.entries = journal.entries.filter(e => Number(e.tag.slice(0, 4)) < 21);
    writeFileSync(journalFile, JSON.stringify(journal));

    const sqlite = new Database(join(dir, 'x.db'));
    sqlite.pragma('foreign_keys = ON');
    const raw = drizzle(sqlite);
    migrate(raw, { migrationsFolder: partial }); // the database as it was before S45
    const now = Date.now();
    sqlite.prepare('insert into trainings (name, created_at) values (?, ?)').run('Cũ', now);
    sqlite.prepare('insert into training_members (training_id, display_name, token, ingest_token, consented_at) values (1, ?, ?, ?, ?)').run('Cũ', 't-old', 'i-old', now);
    sqlite.prepare("insert into training_events (member_id, kind, claude_session_id, received_at, prompt) values (1, 'prompt', 's1', ?, 'hỏi')").run(now);
    sqlite.prepare("insert into training_teaching_examples (event_id, label, topic, comment, updated_at) values (1, 'good', 'verify', 'cũ', ?)").run(now);
    migrate(raw, { migrationsFolder: full });

    expect(sqlite.prepare('select origin, ai_draft as aiDraft from training_teaching_examples').all()).toEqual([{ origin: 'mentor', aiDraft: null }]);
    sqlite.prepare("insert into training_example_drafts (event_id, status, created_at) values (1, 'queued', ?)").run(now);
    expect(sqlite.prepare('select status, suspicious, seen_at as seenAt from training_example_drafts').all()).toEqual([{ status: 'queued', suspicious: 0, seenAt: null }]);
    expect(() => sqlite.prepare("insert into training_example_drafts (event_id, status, created_at) values (1, 'queued', ?)").run(now)).toThrow(/UNIQUE|PRIMARY/i); // one draft per prompt
    expect(() => sqlite.prepare("insert into training_example_drafts (event_id, status, created_at) values (99, 'queued', ?)").run(now)).toThrow(/FOREIGN KEY/i);
    sqlite.prepare('delete from training_members').run(); // the member goes: events, examples and drafts go by cascade
    expect(sqlite.prepare('select count(*) as n from training_example_drafts').get()).toEqual({ n: 0 });
    sqlite.close();
  });
});
