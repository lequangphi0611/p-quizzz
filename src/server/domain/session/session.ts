import type { SessionStatus } from '../../../shared/session-state.js';
import type { OutsiderPolicy, ScoreVisibility, SessionAccess } from '../../../shared/api/sessions.js';
import type { SessionModeId } from './mode.js';

export interface Session {
  id: number;
  examId: number;
  mode: SessionModeId;
  status: SessionStatus;
  /** Mentor-only label that tells parallel sessions apart (PRODUCT.md §7.5). Members and the projector see the exam title. */
  name: string;
  shuffle: boolean;
  autoApprove: boolean;
  /** Who may join: anyone with the code, or only the emails on the session's list (PRODUCT.md §7.22). */
  access: SessionAccess;
  /** Roster sessions: what happens to someone not on the list. */
  outsiderPolicy: OutsiderPolicy;
  /** The saved group this session's list was copied from (or saved as later); null for free sessions and unsaved temp lists. */
  sourceGroupId: number | null;
  /** When members see scores and the leaderboard (PRODUCT.md §7.25). */
  scoreVisibility: ScoreVisibility;
  /** When the mentor published held-back scores; null until then (closing publishes them without setting this). */
  scoresReleasedAt: Date | null;
  /** Lowest number not used by another open session; set when the room opens, cleared when it closes. */
  slot: number | null;
  /** Null until the session is opened; a fresh code each time it opens. */
  roomCode: string | null;
  createdAt: Date;
  openedAt: Date | null;
  startedAt: Date | null;
  closedAt: Date | null;
  finalizedAt: Date | null;
}

export interface NewSession {
  examId: number;
  name: string;
  mode: SessionModeId;
  shuffle: boolean;
  autoApprove: boolean;
  access: SessionAccess;
  outsiderPolicy: OutsiderPolicy;
  sourceGroupId: number | null;
  scoreVisibility: ScoreVisibility;
  createdAt: Date;
}

/** The fields a lifecycle transition (or the score-visibility setting) may change. */
export type SessionPatch = Partial<
  Pick<Session, 'status' | 'roomCode' | 'slot' | 'openedAt' | 'startedAt' | 'closedAt' | 'finalizedAt' | 'scoreVisibility' | 'scoresReleasedAt'>
>;
