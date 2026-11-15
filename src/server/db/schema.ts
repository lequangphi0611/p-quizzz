// Drizzle schema — contract: docs/architecture.md §2. Run `npm run db:generate` after changing this file.
// Column naming: snake_case in SQLite, camelCase in Drizzle. Timestamps are epoch ms (`timestamp_ms`).
import { relations, sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

const id = () => integer('id').primaryKey({ autoIncrement: true });
const ts = (name: string) => integer(name, { mode: 'timestamp_ms' });

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const exams = sqliteTable('exams', {
  id: id(),
  title: text('title').notNull(),
  description: text('description'),
  // Verbatim imported file. Exams are immutable after creation.
  sourceMarkdown: text('source_markdown').notNull(),
  totalPoints: integer('total_points').notNull(),
  hasEssay: integer('has_essay', { mode: 'boolean' }).notNull().default(false),
  createdAt: ts('created_at').notNull(),
});

export const questions = sqliteTable(
  'questions',
  {
    id: id(),
    examId: integer('exam_id').notNull().references(() => exams.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    type: text('type', { enum: ['single', 'multi', 'essay'] }).notNull(),
    prompt: text('prompt').notNull(),
    body: text('body').notNull().default(''),
    points: integer('points').notNull(),
    explanation: text('explanation'),
  },
  t => [index('questions_exam_idx').on(t.examId, t.position)],
);

export const options = sqliteTable(
  'options',
  {
    id: id(),
    questionId: integer('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    text: text('text').notNull(),
    isCorrect: integer('is_correct', { mode: 'boolean' }).notNull().default(false),
  },
  t => [index('options_question_idx').on(t.questionId, t.position)],
);

// No cascade from exams: deleting an exam that has sessions is blocked (API layer returns a friendly error).
export const sessions = sqliteTable(
  'sessions',
  {
    id: id(),
    examId: integer('exam_id').notNull().references(() => exams.id),
    mode: text('mode', { enum: ['self_paced', 'live'] }).notNull().default('self_paced'),
    status: text('status', { enum: ['draft', 'lobby', 'running', 'closed', 'finalized'] }).notNull().default('draft'),
    shuffle: integer('shuffle', { mode: 'boolean' }).notNull().default(true),
    // 6 random digits, generated when the session is opened (null while draft). Members need it to join.
    roomCode: text('room_code'),
    createdAt: ts('created_at').notNull(),
    openedAt: ts('opened_at'),
    startedAt: ts('started_at'),
    closedAt: ts('closed_at'),
    finalizedAt: ts('finalized_at'),
  },
  // Unique across all sessions (NULLs, i.e. drafts, may repeat): an old link can never reach a newer session.
  t => [uniqueIndex('sessions_room_code_uq').on(t.roomCode)],
);

export const participants = sqliteTable(
  'participants',
  {
    id: id(),
    sessionId: integer('session_id').notNull().references(() => sessions.id),
    displayName: text('display_name').notNull(),
    token: text('token').notNull().unique(),
    status: text('status', { enum: ['active', 'pending', 'kicked'] }).notNull().default('active'),
    joinedAt: ts('joined_at').notNull(),
  },
  t => [
    // A display name is unique (case-insensitive) within a session, among participants not kicked.
    uniqueIndex('participants_session_name_uq')
      .on(t.sessionId, sql`lower(${t.displayName})`)
      .where(sql`${t.status} != 'kicked'`),
  ],
);

export const attempts = sqliteTable(
  'attempts',
  {
    id: id(),
    participantId: integer('participant_id').notNull().references(() => participants.id),
    attemptNo: integer('attempt_no').notNull(),
    // Shuffle order is generated when the attempt is created.
    questionOrder: text('question_order', { mode: 'json' }).$type<number[]>().notNull(),
    optionOrder: text('option_order', { mode: 'json' }).$type<Record<string, number[]>>().notNull(),
    startedAt: ts('started_at').notNull(),
    submittedAt: ts('submitted_at'),
    autoScore: real('auto_score'),
    manualScore: real('manual_score'),
  },
  t => [uniqueIndex('attempts_participant_no_uq').on(t.participantId, t.attemptNo)],
);

export const answers = sqliteTable(
  'answers',
  {
    id: id(),
    attemptId: integer('attempt_id').notNull().references(() => attempts.id),
    questionId: integer('question_id').notNull().references(() => questions.id),
    selectedOptionIds: text('selected_option_ids', { mode: 'json' }).$type<number[]>(),
    textAnswer: text('text_answer'),
    autoScore: real('auto_score'),
    manualScore: real('manual_score'),
    feedback: text('feedback'),
    gradedAt: ts('graded_at'),
  },
  t => [uniqueIndex('answers_attempt_question_uq').on(t.attemptId, t.questionId)],
);

export const examsRelations = relations(exams, ({ many }) => ({ questions: many(questions), sessions: many(sessions) }));
export const questionsRelations = relations(questions, ({ one, many }) => ({
  exam: one(exams, { fields: [questions.examId], references: [exams.id] }),
  options: many(options),
}));
export const optionsRelations = relations(options, ({ one }) => ({
  question: one(questions, { fields: [options.questionId], references: [questions.id] }),
}));
export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  exam: one(exams, { fields: [sessions.examId], references: [exams.id] }),
  participants: many(participants),
}));
export const participantsRelations = relations(participants, ({ one, many }) => ({
  session: one(sessions, { fields: [participants.sessionId], references: [sessions.id] }),
  attempts: many(attempts),
}));
export const attemptsRelations = relations(attempts, ({ one, many }) => ({
  participant: one(participants, { fields: [attempts.participantId], references: [participants.id] }),
  answers: many(answers),
}));
export const answersRelations = relations(answers, ({ one }) => ({
  attempt: one(attempts, { fields: [answers.attemptId], references: [attempts.id] }),
  question: one(questions, { fields: [answers.questionId], references: [questions.id] }),
}));
