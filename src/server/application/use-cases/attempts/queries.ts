import { assertReviewable, memberAttemptState, reviewState, type Attempt } from '../../../domain/attempt/attempt.js';
import { AttemptNotFoundError } from '../../../domain/attempt/errors.js';
import { ExamNotFoundError } from '../../../domain/exam/errors.js';
import { ParticipantNotFoundError } from '../../../domain/participant/errors.js';
import type { Participant } from '../../../domain/participant/participant.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { AttemptReader, MemberRoom, MemberRoomReader } from '../../ports/attempt-repository.js';
import type { ExamReader } from '../../ports/exam-repository.js';
import type { ParticipantReader } from '../../ports/participant-repository.js';
import type { SessionRepository } from '../../ports/session-repository.js';
import type { AttemptViewData, ReviewData } from './attempt-data.js';

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
    const exam = await loadExam(this.deps, (await loadSession(this.deps, participant.sessionId)).examId);
    return { attempt, answers: await this.deps.attempts.answersOf(attempt.id), exam };
  }
}

/** ⚠️ Carries the answer key. Refused until the session has closed, so nobody reads it while others are still working. */
export class GetAttemptReview {
  constructor(private readonly deps: ReadDeps) {}

  async execute(participant: Participant, attemptId: number): Promise<ReviewData> {
    const attempt = await this.deps.attempts.findOwned(participant.id, attemptId);
    if (!attempt) throw new AttemptNotFoundError();
    const session = await loadSession(this.deps, participant.sessionId);
    assertReviewable(attempt, session.status);
    const exam = await loadExam(this.deps, session.examId);
    return { attempt, answers: await this.deps.attempts.answersOf(attempt.id), exam, sessionStatus: session.status };
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
}

/** `GET /api/me`: every member polls it, so it keeps to a few small queries (an aggregate for the max score, not the exam content). */
export class GetMemberState {
  constructor(private readonly deps: { attempts: AttemptReader; sessions: Pick<SessionRepository, 'findById'>; exams: Pick<ExamReader, 'maxAutoScoreOf'>; rooms: MemberRoomReader }) {}

  async execute(participant: Participant): Promise<MemberState> {
    const room = await this.deps.rooms.find(participant.sessionId);
    const session = await this.deps.sessions.findById(participant.sessionId);
    if (!room || !session) throw new SessionNotFoundError();
    const maxScore = await this.deps.exams.maxAutoScoreOf(session.examId);
    const attempts = await this.deps.attempts.listByParticipant(participant.id);
    const { current, submitted, canStartNew } = memberAttemptState({ attempts, sessionStatus: session.status, participantStatus: participant.status });
    return { participant, room, current, submitted, canStartNew, maxScore };
  }
}
