import type { ParticipantProgress } from '../../../shared/api/index.js';
import type { SessionStatus } from '../../../shared/session-state.js';
import type { NewSession, Session, SessionPatch } from '../../domain/session/session.js';
import type { ExamReader } from './exam-repository.js';
import type { SessionModeId } from '../../domain/session/mode.js';

/** Write side: only reachable inside a unit of work (see `SessionUnitContext`). */
export interface SessionRepository {
  findById(id: number): Promise<Session | null>;
  create(session: NewSession): Promise<number>;
  update(id: number, patch: SessionPatch): Promise<void>;
  /** Is a session other than `id` in lobby or running? (At most one may be.) */
  hasActiveOtherThan(id: number): Promise<boolean>;
  roomCodeInUse(code: string): Promise<boolean>;
}

// ── Read models (what the mentor's screens show) ─────────────────────────────────────────────────
export interface SessionSummaryView {
  id: number;
  examId: number;
  examTitle: string;
  mode: SessionModeId;
  status: SessionStatus;
  shuffle: boolean;
  autoApprove: boolean;
  roomCode: string | null;
  createdAt: Date;
  openedAt: Date | null;
  startedAt: Date | null;
  closedAt: Date | null;
  finalizedAt: Date | null;
  /** Participants with status 'active'. */
  participantCount: number;
}

export interface SessionParticipantView {
  id: number;
  displayName: string;
  status: 'active' | 'pending' | 'kicked';
  joinedAt: Date;
  progress: ParticipantProgress;
}

export interface SessionDetailView extends SessionSummaryView {
  exam: { id: number; title: string; hasEssay: boolean; totalPoints: number };
  participants: SessionParticipantView[];
}

export interface ActiveSessionView {
  id: number;
  title: string;
  status: SessionStatus;
}

export interface SessionReader {
  /** Newest first. */
  list(): Promise<SessionSummaryView[]>;
  findDetail(id: number): Promise<SessionDetailView | null>;
  /** The session in lobby/running, if any. */
  findActive(): Promise<ActiveSessionView | null>;
  /** The active session, else the most recent one that has ended (the projector follows this). */
  findLatest(): Promise<ActiveSessionView | null>;
}

// ── Seams to modules that have not moved yet ─────────────────────────────────────────────────────
// Closing a session needs attempts and grading, which are still legacy services. These ports are what the
// sessions module needs from them; infrastructure wraps the old code, and P3-3 / P3-4 replace the adapters
// with the real use cases.

/** Submits and scores every unfinished attempt of active members (kicked members' attempts are left alone). */
export interface AttemptAutoSubmitter {
  /** Returns how many attempts were submitted. */
  submitOpenAttempts(sessionId: number): Promise<number>;
}

/** Essay answers of counted attempts that still need a manual score. */
export interface UngradedEssayCounter {
  count(sessionId: number): Promise<number>;
}

export interface SessionUnitContext {
  sessions: SessionRepository;
  exams: ExamReader;
  attempts: AttemptAutoSubmitter;
  grading: UngradedEssayCounter;
}
