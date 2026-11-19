import type { OutsiderPolicy, ParticipantProgress, RosterSource, ScoreVisibility, SessionAccess } from '../../../shared/api/index.js';
import type { SessionStatus } from '../../../shared/session-state.js';
import type { NewSession, Session, SessionPatch } from '../../domain/session/session.js';
import type { ExamReader } from './exam-repository.js';
import type { GroupRepository } from './group-repository.js';
import type { SessionModeId } from '../../domain/session/mode.js';
import type { Headcount } from '../../domain/session/start.js';
import type { CountdownSource } from '../../../shared/session-start.js';

/** Write side: only reachable inside a unit of work (see `SessionUnitContext`). */
export interface SessionRepository {
  findById(id: number): Promise<Session | null>;
  create(session: NewSession): Promise<number>;
  update(id: number, patch: SessionPatch): Promise<void>;
  /** Lowest positive number not used by a session in lobby/running (the "slot" shown to the mentor). */
  lowestFreeSlot(): Promise<number>;
  roomCodeInUse(code: string): Promise<boolean>;
  /** Copies emails into the session's list (the snapshot, or the mentor adding some later). Returns how many were new. */
  addRoster(sessionId: number, emails: readonly string[]): Promise<number>;
  /** The session's list in the order it was typed. */
  rosterEmails(sessionId: number): Promise<string[]>;
  /** Is this (normalized) email on the session's list? */
  hasRosterEmail(sessionId: number, email: string): Promise<boolean>;
  /** Remember which saved group the list is (or was saved as). */
  setSourceGroup(sessionId: number, groupId: number): Promise<void>;
}

// ── Read models (what the mentor's screens show) ─────────────────────────────────────────────────
export interface SessionSummaryView {
  id: number;
  examId: number;
  examTitle: string;
  name: string;
  slot: number | null;
  access: SessionAccess;
  outsiderPolicy: OutsiderPolicy;
  rosterSource: RosterSource | null;
  mode: SessionModeId;
  status: SessionStatus;
  shuffle: boolean;
  autoApprove: boolean;
  scoreVisibility: ScoreVisibility;
  scoresReleasedAt: Date | null;
  timeLimitMinutes: number | null;
  endsAt: Date | null;
  scheduledStartAt: Date | null;
  countdownEndsAt: Date | null;
  countdownSource: CountdownSource | null;
  autoStartReady: boolean;
  readyMin: number | null;
  startScheduleDroppedAt: Date | null;
  roomCode: string | null;
  createdAt: Date;
  openedAt: Date | null;
  startedAt: Date | null;
  closedAt: Date | null;
  finalizedAt: Date | null;
  sharedAt: Date | null;
  /** Participants with status 'active'. */
  participantCount: number;
  /** Active participants who pressed "Sẵn sàng" (PRODUCT.md §7.31d). */
  readyCount: number;
  /** Participants waiting for the mentor's approval. */
  pendingCount: number;
}

export interface SessionParticipantView {
  id: number;
  displayName: string;
  status: 'active' | 'pending' | 'kicked';
  joinedAt: Date;
  readyAt: Date | null;
  progress: ParticipantProgress;
  email: string | null;
  rejoinAllowedUntil: Date | null;
}

export interface SessionDetailView extends SessionSummaryView {
  exam: { id: number; title: string; hasEssay: boolean; totalPoints: number; questionCount: number };
  participants: SessionParticipantView[];
  roster: { size: number; joined: number; notJoined: string[] } | null;
  /** Requests to take over a seat that are still waiting (open sessions only). Mentor only. */
  rejoinRequests: { id: number; participantId: number; claimantName: string; requestedAt: Date }[];
  /** For the mentor's warnings when sharing (PRODUCT.md §7.33a): other sessions of the same exam in draft/lobby/running, and active members who submitted here. */
  share: { examUnfinishedSessions: number; submitted: number };
}

/** What the public may see: the exam title, never the mentor's session name. */
export interface ActiveSessionView {
  id: number;
  title: string;
  status: SessionStatus;
  access: SessionAccess;
  timeLimitMinutes: number | null;
  endsAt: Date | null;
  scheduledStartAt: Date | null;
  countdownEndsAt: Date | null;
  countdownSource: CountdownSource | null;
  autoStartReady: boolean;
  readyMin: number | null;
  /** Counts only (PRODUCT.md §7.31d): approved people in the room and how many of them are ready. */
  participantCount: number;
  readyCount: number;
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
  /** Ids of running sessions whose deadline is at or before `cutoff`: the deadline watcher asks every second, so ids only. */
  listRunningIdsEndedBy(cutoff: Date): Promise<number[]>;
  /** Lobby sessions that have a scheduled start, a running countdown or "everyone ready" on: the start watcher asks every second. */
  listLobbyIdsWithStartPlan(): Promise<number[]>;
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
  /** Numbers only (the projector's "đã vào X/N"): null for a free session or one that does not exist. */
  rosterCounts(sessionId: number): Promise<{ joinedCount: number; rosterSize: number } | null>;
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

/** Who is in a lobby, for "everyone ready" (PRODUCT.md §7.31e), and who was there when it started (§7.31f). */
export interface LobbyHeadcount {
  count(sessionId: number): Promise<Headcount>;
  /** Marks every approved participant as present at the start: they go straight to question 1. */
  markPresentAtStart(sessionId: number): Promise<void>;
}

export interface SessionUnitContext {
  sessions: SessionRepository;
  lobby: LobbyHeadcount;
  exams: ExamReader;
  attempts: AttemptAutoSubmitter;
  grading: UngradedEssayCounter;
  groups: GroupRepository;
}
