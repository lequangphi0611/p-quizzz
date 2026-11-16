import {
  nextStatus,
  SESSION_ACTION_VERB,
  SESSION_STATUS_LABEL,
  type SessionAction,
  type SessionStatus,
} from '../../../shared/session-state.js';
import { InvalidSessionTransitionError, UngradedEssaysError } from './errors.js';
import type { SessionMode } from './mode.js';
import type { Session, SessionPatch } from './session.js';

// Lifecycle: draft → lobby → running → closed → finalized (docs/architecture.md §3). The state machine itself
// is `shared/session-state.ts` (the web uses it too); these functions add the rules around each transition.
// They are pure: the use case gathers the facts and applies the returned patch.

/** The status `action` leads to, or `InvalidSessionTransitionError` (409) when it is not allowed from now. */
export function assertTransition(session: Pick<Session, 'status'>, action: SessionAction): SessionStatus {
  const next = nextStatus(session.status, action);
  if (!next) throw new InvalidSessionTransitionError(SESSION_ACTION_VERB[action], SESSION_STATUS_LABEL[session.status]);
  return next;
}

export const planOpen = (now: Date, roomCode: string, slot: number): SessionPatch => ({ status: 'lobby', openedAt: now, roomCode, slot });

export const planStart = (now: Date): SessionPatch => ({ status: 'running', startedAt: now });

export function planClose(mode: SessionMode, exam: { hasEssay: boolean }, now: Date): SessionPatch {
  const status = mode.statusAfterClose(exam);
  // Closing frees the slot for the next session to open.
  return status === 'finalized' ? { status, closedAt: now, finalizedAt: now, slot: null } : { status, closedAt: now, slot: null };
}

/** Official results need every counted essay answer scored (blank ones too, usually 0). */
export function planFinalize(now: Date, ungradedEssays: number): SessionPatch {
  if (ungradedEssays > 0) throw new UngradedEssaysError(ungradedEssays);
  return { status: 'finalized', finalizedAt: now };
}
