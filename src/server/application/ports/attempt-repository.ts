import type { Answer, Attempt, EditStatus, NewAttempt } from '../../domain/attempt/attempt.js';
import type { Participant } from '../../domain/participant/participant.js';
import type { SessionStatus } from '../../../shared/session-state.js';
import type { ExamReader } from './exam-repository.js';
import type { ParticipantRepository } from './participant-repository.js';
import type { SessionRepository } from './session-repository.js';

/** Read side. Safe to use outside a unit of work. */
export interface AttemptReader {
  findById(id: number): Promise<Attempt | null>;
  findAnswerById(answerId: number): Promise<Answer | null>;
  /** Submitted attempts of `active` members: the candidates for "the counted attempt" of each member. */
  listSubmittedOfActiveMembers(sessionId: number): Promise<Attempt[]>;
  answersOfAttempts(attemptIds: number[]): Promise<Answer[]>;
  /** The attempt only if it belongs to this participant: someone else's looks exactly like a missing one. */
  findOwned(participantId: number, attemptId: number): Promise<Attempt | null>;
  /** All attempts of one member, by attempt number. */
  listByParticipant(participantId: number): Promise<Attempt[]>;
  answersOf(attemptId: number): Promise<Answer[]>;
}

/** Write side: reachable inside a unit of work (see `AttemptUnitContext`). */
export interface AttemptRepository extends AttemptReader {
  /** Stores the mentor's score and comment on one answer (all null = "Hoàn tác", back to ungraded). */
  gradeAnswer(answerId: number, grade: { manualScore: number | null; feedback: string | null; gradedAt: Date | null }): Promise<Answer>;
  /** Stores the attempt's manual total. */
  setManualScore(attemptId: number, score: number): Promise<void>;
  create(attempt: NewAttempt): Promise<Attempt>;
  /** Unsubmitted attempts of `active` members of the session. Kicked members' attempts never count, so they are left out. */
  listOpenOfActiveMembers(sessionId: number): Promise<Attempt[]>;
  markSubmitted(id: number, submittedAt: Date, autoScore: number): Promise<void>;
  /** Stores the state of the attempt's request to edit its essays (PRODUCT.md §7.21). */
  setEditRequest(id: number, edit: { editStatus: EditStatus; editReason: string | null; editRequestedAt: Date | null; editResolvedAt: Date | null }): Promise<void>;
  /** Insert or replace the saved answer for that question (one row per attempt and question). A field left out keeps its saved value. */
  saveAnswer(attemptId: number, questionId: number, value: { selectedOptionIds?: number[]; textAnswer?: string; reasonText?: string }): Promise<void>;
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
  /** Active participants who pressed "Sẵn sàng" (PRODUCT.md §7.31d). */
  readyCount: number;
  questionCount: number;
}

export interface MemberRoomReader {
  find(sessionId: number): Promise<MemberRoom | null>;
}

export type { Participant };
