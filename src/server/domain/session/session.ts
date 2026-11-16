import type { SessionStatus } from '../../../shared/session-state.js';
import type { SessionModeId } from './mode.js';

export interface Session {
  id: number;
  examId: number;
  mode: SessionModeId;
  status: SessionStatus;
  shuffle: boolean;
  autoApprove: boolean;
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
  mode: SessionModeId;
  shuffle: boolean;
  autoApprove: boolean;
  createdAt: Date;
}

/** The fields a lifecycle transition may change. */
export type SessionPatch = Partial<Pick<Session, 'status' | 'roomCode' | 'openedAt' | 'startedAt' | 'closedAt' | 'finalizedAt'>>;
