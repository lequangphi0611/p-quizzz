import type { Answer, Attempt, NewAttempt } from '../../domain/attempt/attempt.js';
import type { Participant } from '../../domain/participant/participant.js';
import type { SessionStatus } from '../../../shared/session-state.js';
import type { ExamReader } from './exam-repository.js';
import type { ParticipantRepository } from './participant-repository.js';
import type { SessionRepository } from './session-repository.js';

/** Read side. Safe to use outside a unit of work. */
export interface AttemptReader {
  /** The attempt only if it belongs to this participant: someone else's looks exactly like a missing one. */
  findOwned(participantId: number, attemptId: number): Promise<Attempt | null>;
  /** All attempts of one member, by attempt number. */
  listByParticipant(participantId: number): Promise<Attempt[]>;
  answersOf(attemptId: number): Promise<Answer[]>;
}

/** Write side: reachable inside a unit of work (see `AttemptUnitContext`). */
export interface AttemptRepository extends AttemptReader {
  create(attempt: NewAttempt): Promise<Attempt>;
  /** Unsubmitted attempts of `active` members of the session. Kicked members' attempts never count, so they are left out. */
  listOpenOfActiveMembers(sessionId: number): Promise<Attempt[]>;
  markSubmitted(id: number, submittedAt: Date, autoScore: number): Promise<void>;
  /** Insert or replace the saved answer for that question (one row per attempt and question). */
  saveAnswer(attemptId: number, questionId: number, value: { selectedOptionIds?: number[]; textAnswer?: string }): Promise<void>;
  /** Stores the automatic score of every question; creates a blank answer row where the member saved nothing. */
  recordAutoScores(attemptId: number, scores: { questionId: number; autoScore: number | null }[]): Promise<void>;
}

export interface AttemptUnitContext {
  attempts: AttemptRepository;
  sessions: Pick<SessionRepository, 'findById'>;
  participants: Pick<ParticipantRepository, 'findById'>;
  exams: ExamReader;
}

/** What `GET /api/me` shows about the room, in as few queries as before: members poll it. */
export interface MemberRoom {
  id: number;
  title: string;
  status: SessionStatus;
  totalPoints: number;
  hasEssay: boolean;
  /** Participants with status 'active'. */
  participantCount: number;
  questionCount: number;
}

export interface MemberRoomReader {
  find(sessionId: number): Promise<MemberRoom | null>;
}

export type { Participant };
