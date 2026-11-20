import { z } from 'zod';
import { DisplayNameBody, normalizeRoomCode, ROOM_CODE_LENGTH } from './participants.js';
import type { ActiveSession } from './sessions.js';

// AI training sessions (PRODUCT.md §7.34, docs/architecture.md §5 "Buổi training AI").
// Nothing a member sends or receives here carries what was collected (prompts, commands, output): that is mentor-only.

export const TRAINING_NAME_MAX = 100;
export const TRAINING_STATUSES = ['open', 'stopped', 'ended'] as const;
export type TrainingStatus = (typeof TRAINING_STATUSES)[number];

/** Request header carrying the member's browser token. */
export const TRAINING_MEMBER_HEADER = 'x-training-member-token';

// POST /api/admin/trainings
export const CreateTrainingBody = z.object({
  name: z
    .string({ error: 'Nhập tên buổi training' })
    .transform(s => s.trim())
    .refine(s => s.length > 0, 'Tên buổi training không được để trống')
    .refine(s => [...s].length <= TRAINING_NAME_MAX, `Tên buổi training tối đa ${TRAINING_NAME_MAX} ký tự`),
});

// POST /api/trainings/:id/join. `consent` must be literally true: a member only exists once they agreed.
export const JoinTrainingBody = DisplayNameBody.extend({
  roomCode: z
    .string({ error: 'Nhập mã phòng' })
    .transform(normalizeRoomCode)
    .refine(s => s.length === ROOM_CODE_LENGTH, `Mã phòng gồm ${ROOM_CODE_LENGTH} chữ số`),
  consent: z.literal(true, { error: 'Cần đồng ý thì mới tham gia được' }),
});

/** POST /api/rooms/resolve: a room code now leads to a session or to a training. */
export type ResolvedRoom = ({ kind: 'session' } & ActiveSession) | { kind: 'training'; id: number; title: string };

export type TrainingConnection = 'waiting' | 'connected' | 'uninstalled';
export type UninstallCheckState = 'none' | 'waiting' | 'passed' | 'failed';

export interface TrainingSummary {
  id: number;
  name: string;
  status: TrainingStatus;
  createdAt: number;
  stoppedAt: number | null;
  endedAt: number | null;
  memberCount: number;
}

/** POST /api/admin/trainings: the room code is shown to the class right away. */
export interface CreatedTraining extends TrainingSummary {
  roomCode: string;
}

export interface TrainingMemberRow {
  id: number;
  displayName: string;
  connection: TrainingConnection;
  lastSeenAt: number | null;
  promptCount: number;
  toolCount: number;
  failedCount: number;
  stuck: boolean;
  stillSending: boolean;
}

export interface TrainingDetail {
  id: number;
  name: string;
  status: TrainingStatus;
  /** Only while `open`. */
  roomCode: string | null;
  createdAt: number;
  stoppedAt: number | null;
  endedAt: number | null;
  /** Only once `stopped`: how many members confirmed the hook is gone. */
  uninstalled: { count: number; total: number } | null;
  members: TrainingMemberRow[];
}

// POST /api/trainings/:id/join
export interface JoinTrainingResponse {
  token: string;
  member: { displayName: string };
}

// GET /api/training/me: status only, never what was collected.
export interface MyTraining {
  training: { id: number; name: string; status: TrainingStatus };
  member: { displayName: string; connection: TrainingConnection; uninstallCheck: UninstallCheckState };
}

// GET /api/training/me/hook-config
export interface HookConfig {
  /** Merged into the member's `.claude/settings.local.json`. */
  settings: HookSettings;
  /** A ready-to-paste request asking Claude Code to do the merge. */
  mergePrompt: string;
}

export interface HookSettings {
  hooks: Record<'UserPromptSubmit' | 'PostToolUse' | 'PostToolUseFailure', HookEntry[]>;
}

export interface HookEntry {
  matcher?: string;
  hooks: { type: 'http'; url: string; headers: Record<string, string>; timeout: number }[];
}

/** What the member's removal check came to (POST /api/training/me/uninstall-check/finish). */
export interface UninstallCheckResult {
  result: 'passed' | 'failed';
}

/** A long text kept as its first and last lines; `omittedLines` were dropped from the middle. */
export interface Clip {
  head: string;
  tail: string | null;
  omittedLines: number;
}

// GET /api/admin/trainings/:id/members/:memberId/events?after=<eventId>
/** One line of a member's timeline. No output and no change: those are fetched on demand (`TrainingEventDetail`). */
export interface TrainingEventRow {
  id: number;
  kind: 'prompt' | 'tool';
  receivedAt: number;
  claudeSessionId: string;
  /** `prompt` events. */
  prompt?: string;
  /** `tool` events. */
  toolName?: string;
  toolTarget?: string;
  ok?: boolean;
  durationMs?: number;
  /** The error for a failed call, else the last line of text in its output. */
  summary?: string;
  hasOutput: boolean;
  hasChange: boolean;
}

export interface TrainingEventsPage {
  /** Oldest first, at most 500. */
  events: TrainingEventRow[];
  hasMore: boolean;
}

// GET /api/admin/trainings/:id/events/:eventId/detail
export interface TrainingEventDetail {
  output: Clip | null;
  change: Clip | null;
}
