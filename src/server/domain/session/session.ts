import type { SessionStatus } from '../../../shared/session-state.js';
import type { OutsiderPolicy, ScoreVisibility, SessionAccess } from '../../../shared/api/sessions.js';
import type { CountdownSource } from '../../../shared/session-start.js';
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
  /** Time limit in minutes; null = none (PRODUCT.md §7.27). Editable until the session starts. */
  timeLimitMinutes: number | null;
  /** The shared deadline: start + limit, pushed back by "+N phút". Null until the session starts or without a limit. */
  endsAt: Date | null;
  /** The mentor's scheduled start (PRODUCT.md §7.31b); null = none. Set while draft/lobby. */
  scheduledStartAt: Date | null;
  /** End of the 10-second countdown of "Bắt đầu ngay" / "everyone ready" (§7.31c); null while none runs. */
  countdownEndsAt: Date | null;
  countdownSource: CountdownSource | null;
  /** "Tự bắt đầu khi mọi người sẵn sàng" (§7.31e), off by default; `readyMin` people at least. */
  autoStartReady: boolean;
  readyMin: number | null;
  /** When a scheduled start was dropped because it passed while the server was off or asleep (§7.31b); the bell says so. */
  startScheduleDroppedAt: Date | null;
  /** Lowest number not used by another open session; set when the room opens, cleared when it closes. */
  slot: number | null;
  /** Null until the session is opened; a fresh code each time it opens. */
  roomCode: string | null;
  createdAt: Date;
  openedAt: Date | null;
  startedAt: Date | null;
  closedAt: Date | null;
  finalizedAt: Date | null;
  /** On the share page since then (PRODUCT.md §7.33); null = not shared. Only set once the session has closed. */
  sharedAt: Date | null;
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
  timeLimitMinutes: number | null;
  createdAt: Date;
}

/** The fields a lifecycle transition (or the score-visibility setting) may change. */
export type SessionPatch = Partial<
  Pick<
    Session,
    | 'status' | 'roomCode' | 'slot' | 'openedAt' | 'startedAt' | 'closedAt' | 'finalizedAt' | 'scoreVisibility' | 'scoresReleasedAt' | 'timeLimitMinutes' | 'endsAt'
    | 'scheduledStartAt' | 'countdownEndsAt' | 'countdownSource' | 'autoStartReady' | 'readyMin' | 'startScheduleDroppedAt' | 'sharedAt'
  >
>;
