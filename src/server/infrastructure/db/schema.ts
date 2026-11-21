// Drizzle schema — contract: docs/architecture.md §2. Run `npm run db:generate` after changing this file.
// Column naming: snake_case in SQLite, camelCase in Drizzle. Timestamps are epoch ms (`timestamp_ms`).
import { relations, sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text, uniqueIndex, index, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

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
  // Default time limit (minutes) for sessions of this exam, from the `duration` frontmatter key; null = none (PRODUCT.md §7.27).
  durationMinutes: integer('duration_minutes'),
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
    // `{reason}`: picking an option requires a short unscored reason (PRODUCT.md §7.32).
    requireReason: integer('require_reason', { mode: 'boolean' }).notNull().default(false),
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

// A saved list of member emails (PRODUCT.md §7.22). Only the mentor sees or edits it; a session copies it when created.
export const groups = sqliteTable('groups', {
  id: id(),
  name: text('name').notNull(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
});

export const groupEmails = sqliteTable(
  'group_emails',
  {
    id: id(),
    groupId: integer('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    email: text('email').notNull(), // normalized
    position: integer('position').notNull(), // the order the mentor typed them
  },
  t => [uniqueIndex('group_emails_uq').on(t.groupId, t.email)],
);

// No cascade from exams: deleting an exam that has sessions is blocked (API layer returns a friendly error).
export const sessions = sqliteTable(
  'sessions',
  {
    id: id(),
    examId: integer('exam_id').notNull().references(() => exams.id),
    // Mentor-only label that tells parallel sessions apart (PRODUCT.md §7.5); older rows were backfilled with the exam title.
    name: text('name').notNull().default(''),
    mode: text('mode', { enum: ['self_paced', 'live'] }).notNull().default('self_paced'),
    status: text('status', { enum: ['draft', 'lobby', 'running', 'closed', 'finalized'] }).notNull().default('draft'),
    shuffle: integer('shuffle', { mode: 'boolean' }).notNull().default(true),
    autoApprove: integer('auto_approve', { mode: 'boolean' }).notNull().default(false),
    // Who may join (PRODUCT.md §7.22): anyone with the code, or only the emails on `session_roster`.
    access: text('access', { enum: ['free', 'roster'] }).notNull().default('free'),
    // Roster sessions: someone not on the list is turned away ('block') or waits for the mentor ('pending').
    outsiderPolicy: text('outsider_policy', { enum: ['block', 'pending'] }).notNull().default('block'),
    // The saved group this session's list came from (or was saved as). Deleting the group only forgets the link.
    sourceGroupId: integer('source_group_id').references((): AnySQLiteColumn => groups.id, { onDelete: 'set null' }),
    // When members see scores and the leaderboard (PRODUCT.md §7.25): right after submitting, or once the mentor publishes them.
    scoreVisibility: text('score_visibility', { enum: ['on_submit', 'on_release'] }).notNull().default('on_submit'),
    // Set when the mentor presses "Công bố điểm". Closing the session publishes held scores too, without setting this.
    scoresReleasedAt: ts('scores_released_at'),
    // Time limit in minutes (PRODUCT.md §7.27); null = none. Defaults from the exam's `duration`, editable until the start.
    timeLimitMinutes: integer('time_limit_minutes'),
    // The shared deadline: set on start (start + limit), pushed back by "+N phút". Past it (plus grace) the session closes itself.
    endsAt: ts('ends_at'),
    // How the session starts (PRODUCT.md §7.31): the scheduled time, a 10-second countdown ("Bắt đầu ngay" / everyone
    // ready), whichever comes first. A start that passed while the server was off is dropped (start_schedule_dropped_at).
    scheduledStartAt: ts('scheduled_start_at'),
    countdownEndsAt: ts('countdown_ends_at'),
    countdownSource: text('countdown_source', { enum: ['now', 'ready'] }),
    autoStartReady: integer('auto_start_ready', { mode: 'boolean' }).notNull().default(false),
    readyMin: integer('ready_min'),
    startScheduleDroppedAt: ts('start_schedule_dropped_at'),
    // 6 random digits, generated when the session is opened (null while draft). Members need it to join.
    roomCode: text('room_code'),
    // Lowest number free among open sessions, set on open and cleared on close (for the mentor's "Đang mở" bar).
    slot: integer('slot'),
    createdAt: ts('created_at').notNull(),
    openedAt: ts('opened_at'),
    startedAt: ts('started_at'),
    closedAt: ts('closed_at'),
    finalizedAt: ts('finalized_at'),
    // Shown on the share page since then (PRODUCT.md §7.33); null = not shared. Only set once the session has closed.
    sharedAt: ts('shared_at'),
  },
  // Unique across all sessions (NULLs, i.e. drafts, may repeat): an old link can never reach a newer session.
  t => [uniqueIndex('sessions_room_code_uq').on(t.roomCode)],
);

// The list of one session: a copy taken when the session was created, so editing or deleting the group later changes
// nothing here (PRODUCT.md §7.22d). The mentor may add emails to a running session.
export const sessionRoster = sqliteTable(
  'session_roster',
  {
    id: id(),
    sessionId: integer('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
    email: text('email').notNull(), // normalized
    position: integer('position').notNull(),
  },
  t => [uniqueIndex('session_roster_uq').on(t.sessionId, t.email)],
);

export const participants = sqliteTable(
  'participants',
  {
    id: id(),
    sessionId: integer('session_id').notNull().references(() => sessions.id),
    displayName: text('display_name').notNull(),
    // Normalized email in a roster session (mentor-only data, PRODUCT.md §7.24); null in a free one.
    email: text('email'),
    token: text('token').notNull().unique(),
    // The token this person had before the mentor let them back in from another device: the old device is told so (403 `replaced`).
    replacedToken: text('replaced_token'),
    // The mentor said "let them back in": until then, entering the same email/name takes the seat over without asking (one time).
    rejoinAllowedUntil: ts('rejoin_allowed_until'),
    status: text('status', { enum: ['active', 'pending', 'kicked'] }).notNull().default('active'),
    joinedAt: ts('joined_at').notNull(),
    // Pressed "Sẵn sàng" in the lobby (PRODUCT.md §7.31d).
    readyAt: ts('ready_at'),
    // Approved and in the room when the session started: they go straight to question 1; the others joined late (§7.31f).
    presentAtStart: integer('present_at_start', { mode: 'boolean' }).notNull().default(false),
  },
  t => [
    // A display name is unique (case-insensitive) within a session, among participants not kicked.
    uniqueIndex('participants_session_name_uq')
      .on(t.sessionId, sql`lower(${t.displayName})`)
      .where(sql`${t.status} != 'kicked'`),
    // One person per email in a session (emails are normalized in the domain, so a plain index is exact).
    uniqueIndex('participants_session_email_uq')
      .on(t.sessionId, t.email)
      .where(sql`${t.status} != 'kicked' and ${t.email} is not null`),
  ],
);

// Someone typed an email/name that already has a person in the session and asked the mentor to let them in (PRODUCT.md §7.23).
// `token` is the token the claimant will hold if the mentor approves: until then it only reads the request's status.
export const rejoinRequests = sqliteTable(
  'rejoin_requests',
  {
    id: id(),
    participantId: integer('participant_id').notNull().references(() => participants.id),
    claimantName: text('claimant_name').notNull(),
    token: text('token').notNull().unique(),
    status: text('status', { enum: ['pending', 'approved', 'rejected', 'cancelled'] }).notNull().default('pending'),
    createdAt: ts('created_at').notNull(),
    resolvedAt: ts('resolved_at'),
  },
  t => [index('rejoin_requests_participant_idx').on(t.participantId, t.status)],
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
    // Request to reopen the essay part after submitting (PRODUCT.md §7.21). Null = never asked.
    editStatus: text('edit_status', { enum: ['pending', 'approved', 'rejected', 'done'] }),
    editReason: text('edit_reason'),
    editRequestedAt: ts('edit_requested_at'),
    editResolvedAt: ts('edit_resolved_at'),
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
    // Member's reason for the pick on a `{reason}` question; never scored (PRODUCT.md §7.32).
    reasonText: text('reason_text'),
    autoScore: real('auto_score'),
    manualScore: real('manual_score'),
    feedback: text('feedback'),
    gradedAt: ts('graded_at'),
  },
  t => [uniqueIndex('answers_attempt_question_uq').on(t.attemptId, t.questionId)],
);

// AI grading suggestion for one essay answer (PRODUCT.md §7.28). Never a score: only the mentor's grade counts.
export const aiSuggestions = sqliteTable('ai_suggestions', {
  id: id(),
  answerId: integer('answer_id')
    .notNull()
    .unique()
    .references(() => answers.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['queued', 'running', 'done', 'failed'] }).notNull(),
  score: real('score'),
  feedback: text('feedback'),
  criteria: text('criteria', { mode: 'json' }).$type<{ label: string; score: number; max: number; note: string }[]>(),
  suspicious: integer('suspicious', { mode: 'boolean' }).notNull().default(false),
  suspiciousReason: text('suspicious_reason'),
  suspiciousLines: text('suspicious_lines', { mode: 'json' }).$type<number[]>(),
  error: text('error'),
  model: text('model'),
  // How the mentor used it when saving the grade: one tap ("accepted") or edited first. Null = graded by hand / not yet.
  used: text('used', { enum: ['accepted', 'edited'] }),
  requestedAt: ts('requested_at').notNull(),
  finishedAt: ts('finished_at'),
});

// AI training session (PRODUCT.md §7.34): its own concept, not tied to an exam or a session.
export const trainings = sqliteTable(
  'trainings',
  {
    id: id(),
    name: text('name').notNull(),
    status: text('status', { enum: ['open', 'stopped', 'ended'] }).notNull().default('open'),
    // 6 digits while open; null once stopped. Shares its space with `sessions.room_code` (the code allocator checks both).
    roomCode: text('room_code'),
    createdAt: ts('created_at').notNull(),
    stoppedAt: ts('stopped_at'),
    endedAt: ts('ended_at'),
    // Written when the training ends, because the members are deleted then.
    memberCount: integer('member_count'),
    // S39: the mentor expects auto-accept / bypass here, so the flag for it stays down.
    allowAutoAccept: integer('allow_auto_accept', { mode: 'boolean' }).notNull().default(false),
  },
  t => [uniqueIndex('trainings_room_code_uq').on(t.roomCode)],
);

// Exists only once the member agreed. Withdrawing or being removed deletes the row (and, by cascade, every event).
export const trainingMembers = sqliteTable(
  'training_members',
  {
    id: id(),
    trainingId: integer('training_id').notNull().references(() => trainings.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    // The member's browser token.
    token: text('token').notNull().unique(),
    // Lives in the hook config on the member's machine; a different value, so leaking that file only allows fake events.
    ingestToken: text('ingest_token').notNull().unique(),
    consentedAt: ts('consented_at').notNull(),
    firstSeenAt: ts('first_seen_at'),
    lastSeenAt: ts('last_seen_at'),
    // The member pressed "Dừng gửi" while open (S38): nothing new is accepted, what was sent stays until the mentor approves deleting it.
    stoppedSendingAt: ts('stopped_sending_at'),
    // An event arrived after "Dừng thu" or "Dừng gửi": the hook is still installed on that machine.
    seenAfterStopAt: ts('seen_after_stop_at'),
    uninstallCheckAt: ts('uninstall_check_at'),
    uninstalledAt: ts('uninstalled_at'),
  },
  // Case-insensitive for ASCII only (SQLite); the domain rule covers all of Unicode.
  t => [uniqueIndex('training_members_name_uq').on(t.trainingId, sql`lower(${t.displayName})`)],
);

// What the hook sent, already filtered (docs/architecture.md §11.8); the raw JSON is never stored. Written by S33.
export const trainingEvents = sqliteTable(
  'training_events',
  {
    id: id(),
    memberId: integer('member_id').notNull().references(() => trainingMembers.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['prompt', 'tool', 'permission', 'session', 'notice'] }).notNull(),
    claudeSessionId: text('claude_session_id').notNull(),
    // S37 (architecture.md §11.9): Claude Code's permission mode and turn id, the subtype of session / notice rows, and a short note.
    permissionMode: text('permission_mode'),
    promptId: text('prompt_id'),
    subtype: text('subtype'),
    note: text('note'),
    receivedAt: ts('received_at').notNull(),
    prompt: text('prompt'),
    toolName: text('tool_name'),
    toolTarget: text('tool_target'),
    ok: integer('ok', { mode: 'boolean' }),
    durationMs: integer('duration_ms'),
    errorExcerpt: text('error_excerpt'),
    outputHead: text('output_head'),
    outputTail: text('output_tail'),
    outputOmittedLines: integer('output_omitted_lines'),
    changeHead: text('change_head'),
    changeTail: text('change_tail'),
    changeOmittedLines: integer('change_omitted_lines'),
  },
  t => [index('training_events_member_idx').on(t.memberId, t.id)],
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
