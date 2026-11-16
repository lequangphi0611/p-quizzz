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
  /** Lowest positive number not used by a session in lobby/running (the "slot" shown to the mentor). */
  lowestFreeSlot(): Promise<number>;
  roomCodeInUse(code: string): Promise<boolean>;
}

// ── Read models (what the mentor's screens show) ─────────────────────────────────────────────────
export interface SessionSummaryView {
  id: number;
  examId: number;
  examTitle: string;
  name: string;
  slot: number | null;
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

/** What the public may see: the exam title, never the mentor's session name. */
export interface ActiveSessionView {
  id: number;
  title: string;
  status: SessionStatus;
}

/** The projector chooser (mentor machine only), so it may carry the session name. */
export interface ScreenSessionView {
  id: number;
  name: string;
  slot: number | null;
  title: string;
  status: SessionStatus;
}

export interface SessionReader {
  exists(id: number): Promise<boolean>;
  /** Newest first. */
  list(): Promise<SessionSummaryView[]>;
  findDetail(id: number): Promise<SessionDetailView | null>;
  /** Sessions in lobby/running, lowest slot first. */
  listActive(): Promise<SessionSummaryView[]>;
  /** Public view of one session (exam title only). */
  findPublic(id: number): Promise<ActiveSessionView | null>;
  /** The session in lobby/running with this room code, if any. */
  findOpenByRoomCode(code: string): Promise<ActiveSessionView | null>;
  /** Room code of an open session. Mentor machine only: never part of a public response. */
  findOpenRoomCode(id: number): Promise<string | null>;
  /** Open sessions for the projector chooser, lowest slot first. */
  listScreenSessions(): Promise<ScreenSessionView[]>;
  /** The most recent session that has ended (closed/finalized). */
  findLatestEnded(): Promise<ScreenSessionView | null>;
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
