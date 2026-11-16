import type { SessionMode as SessionModeId } from '../../../shared/api/index.js';
import { UnsupportedSessionModeError } from './errors.js';

export type { SessionModeId };

/**
 * What differs between session modes. Lifecycle code asks the mode instead of checking
 * `mode === 'self_paced'`, so phase 2 adds `live` by writing a new `SessionMode` and registering it.
 */
export interface SessionMode {
  readonly id: SessionModeId;
  /** Closing the session submits and scores every unfinished attempt. */
  readonly submitsOpenAttemptsOnClose: boolean;
  /** Status right after `close`: `finalized` when there is nothing left to grade by hand. */
  statusAfterClose(exam: { hasEssay: boolean }): 'closed' | 'finalized';
}

/** Members work at their own pace; closing sweeps up unfinished attempts. */
export const SelfPacedMode: SessionMode = {
  id: 'self_paced',
  submitsOpenAttemptsOnClose: true,
  statusAfterClose: exam => (exam.hasEssay ? 'closed' : 'finalized'),
};

export interface SessionModeRegistry {
  /** Throws `UnsupportedSessionModeError` for a mode with no registered strategy. */
  get(id: SessionModeId): SessionMode;
}

export class StaticSessionModes implements SessionModeRegistry {
  private readonly byId: Map<string, SessionMode>;

  constructor(modes: SessionMode[]) {
    this.byId = new Map(modes.map(m => [m.id, m]));
  }

  get(id: SessionModeId): SessionMode {
    const mode = this.byId.get(id);
    if (!mode) throw new UnsupportedSessionModeError(id);
    return mode;
  }
}

/** The modes in scope today. `live` is phase 2. */
export const defaultSessionModes = (): SessionModeRegistry => new StaticSessionModes([SelfPacedMode]);
