import { assertReviewable, memberAttemptState, reviewState, type Attempt } from '../../../domain/attempt/attempt.js';
import { AttemptNotFoundError } from '../../../domain/attempt/errors.js';
import { ExamNotFoundError } from '../../../domain/exam/errors.js';
import { ParticipantNotFoundError } from '../../../domain/participant/errors.js';
import type { Participant } from '../../../domain/participant/participant.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import { areScoresHidden } from '../../../domain/session/score-visibility.js';
import { closedByTimer, sessionTimer } from '../../../domain/session/time-limit.js';
import type { SessionTimer } from '../../../../shared/session-timer.js';
import type { Clock } from '../../ports/clock.js';
import { sessionStartInfo } from '../../../domain/session/start.js';
import type { SessionStartInfo } from '../../../../shared/session-start.js';
import type { AttemptReader, MemberRoom, MemberRoomReader } from '../../ports/attempt-repository.js';
import type { ExamReader } from '../../ports/exam-repository.js';
import type { ParticipantReader } from '../../ports/participant-repository.js';
import type { SessionRepository } from '../../ports/session-repository.js';
import type { AttemptViewData, ReviewData } from './attempt-data.js';
import type { AiSuggestionReader } from '../../ports/ai-suggestion-repository.js';

interface ReadDeps {
  attempts: AttemptReader;
  sessions: Pick<SessionRepository, 'findById'>;
  exams: ExamReader;
}

async function loadSession(deps: ReadDeps, sessionId: number) {
  const session = await deps.sessions.findById(sessionId);
  if (!session) throw new SessionNotFoundError();
  return session;
}

async function loadExam(deps: ReadDeps, examId: number) {
  const exam = await deps.exams.findById(examId);
  if (!exam) throw new ExamNotFoundError();
  return exam;
}

/** The member's question screen: questions in this attempt's order, plus what they saved so far. */
export class GetAttemptView {
  constructor(private readonly deps: ReadDeps) {}

  async execute(participant: Participant, attemptId: number): Promise<AttemptViewData> {
    const attempt = await this.deps.attempts.findOwned(participant.id, attemptId);
    if (!attempt) throw new AttemptNotFoundError();
    const session = await loadSession(this.deps, participant.sessionId);
    const exam = await loadExam(this.deps, session.examId);
    return { attempt, answers: await this.deps.attempts.answersOf(attempt.id), exam, sessionStatus: session.status };
  }
}

/** ⚠️ Carries the answer key. Refused until the session has closed, so nobody reads it while others are still working. */
export class GetAttemptReview {
  constructor(private readonly deps: ReadDeps & { aiSuggestions?: Pick<AiSuggestionReader, 'questionsWithDoneInSession'> }) {}

  async execute(participant: Participant, attemptId: number): Promise<ReviewData> {
    const attempt = await this.deps.attempts.findOwned(participant.id, attemptId);
    if (!attempt) throw new AttemptNotFoundError();
    const session = await loadSession(this.deps, participant.sessionId);
    assertReviewable(attempt, session.status);
    const exam = await loadExam(this.deps, session.examId);
    const aiAssistedQuestionIds = exam.questions.some(q => q.type === 'essay') ? ((await this.deps.aiSuggestions?.questionsWithDoneInSession(session.id)) ?? []) : [];
    return { attempt, answers: await this.deps.attempts.answersOf(attempt.id), exam, sessionStatus: session.status, aiAssistedQuestionIds };
  }
}

export interface ParticipantReviewResult {
  participant: Participant;
  state: 'none' | 'doing' | 'submitted';
  review: ReviewData | null;
}

/**
 * Mentor's view of one person's work in a session (any status; the route is mentor-only). The attempt is the
 * participant's single submitted one; while it is still being written, or never started, there is nothing to show yet.
 */
export class GetParticipantReview {
  constructor(private readonly deps: ReadDeps & { participants: ParticipantReader }) {}

  async execute(participantId: number): Promise<ParticipantReviewResult> {
    const participant = await this.deps.participants.findById(participantId);
    if (!participant) throw new ParticipantNotFoundError();
    const session = await loadSession(this.deps, participant.sessionId);
    const mine = await this.deps.attempts.listByParticipant(participantId);
    const state = reviewState(mine, participant.status, session.status);
    const submitted = mine.find(a => a.submittedAt);
    if (!submitted) return { participant, state, review: null };
    const exam = await loadExam(this.deps, session.examId);
    return { participant, state, review: { attempt: submitted, answers: await this.deps.attempts.answersOf(submitted.id), exam, sessionStatus: session.status } };
  }
}

export interface MemberState {
  participant: Participant;
  room: MemberRoom;
  current: Attempt | null;
  submitted: Attempt[];
  canStartNew: boolean;
  /** Most the automatic part can give: the `maxScore` of every submitted attempt. */
  maxScore: number;
  /** The mentor holds scores back (PRODUCT.md §7.25): the member sees that they submitted and when, not their score. */
  scoresHidden: boolean;
  /** The session's clock (PRODUCT.md §7.27); null without a time limit or once the session ended. */
  timer: SessionTimer | null;
  /** The session closed because its time ran out, not because the mentor closed it early (PRODUCT.md §7.27f, g). */
  closedByTimer: boolean;
  /** How and when the session starts (PRODUCT.md §7.31); null once it has started. */
  start: SessionStartInfo | null;
  /** Started without this person in the room: "còn X phút" before question 1 (§7.31f). */
  lateJoin: boolean;
}

/** `GET /api/me`: every member polls it, so it keeps to a few small queries (an aggregate for the max score, not the exam content). */
export class GetMemberState {
  constructor(private readonly deps: { attempts: AttemptReader; sessions: Pick<SessionRepository, 'findById'>; exams: Pick<ExamReader, 'maxAutoScoreOf'>; rooms: MemberRoomReader; clock: Clock }) {}

  async execute(participant: Participant): Promise<MemberState> {
    const room = await this.deps.rooms.find(participant.sessionId);
    const session = await this.deps.sessions.findById(participant.sessionId);
    if (!room || !session) throw new SessionNotFoundError();
    const maxScore = await this.deps.exams.maxAutoScoreOf(session.examId);
    const attempts = await this.deps.attempts.listByParticipant(participant.id);
    const { current, submitted, canStartNew } = memberAttemptState({ attempts, sessionStatus: session.status, participantStatus: participant.status });
    const now = this.deps.clock.now();
    return {
      participant, room, current, submitted, canStartNew, maxScore,
      scoresHidden: areScoresHidden(session),
      timer: sessionTimer(session, now),
      closedByTimer: closedByTimer(session),
      start: sessionStartInfo(session, { count: room.readyCount, total: room.participantCount }, now),
      lateJoin: session.status !== 'draft' && session.status !== 'lobby' && !participant.presentAtStart,
    };
  }
}
