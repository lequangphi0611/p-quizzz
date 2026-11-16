import type { SessionStatus } from '../../../shared/session-state.js';
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
  createdAt: Date;
}

/** The fields a lifecycle transition may change. */
export type SessionPatch = Partial<Pick<Session, 'status' | 'roomCode' | 'slot' | 'openedAt' | 'startedAt' | 'closedAt' | 'finalizedAt'>>;
