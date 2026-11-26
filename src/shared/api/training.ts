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
  /** The mentor tells the app that auto-accept / bypass is expected here, so the flag for it stays down. */
  allowAutoAccept: z.boolean().optional().default(false),
});

export const MENTOR_NOTE_MAX = 2000;

// PUT /api/admin/trainings/:id/members/:memberId/note. An empty note clears it.
export const MemberNoteBody = z.object({
  note: z
    .string({ error: 'Nhập ghi chú' })
    .transform(s => s.trim())
    .refine(s => [...s].length <= MENTOR_NOTE_MAX, `Ghi chú tối đa ${MENTOR_NOTE_MAX} ký tự`),
});

// POST /api/trainings/:id/join. `consent` must be literally true: a member only exists once they agreed.
export const JoinTrainingBody = DisplayNameBody.extend({
  roomCode: z
    .string({ error: 'Nhập mã phòng' })
    .transform(normalizeRoomCode)
    .refine(s => s.length === ROOM_CODE_LENGTH, `Mã phòng gồm ${ROOM_CODE_LENGTH} chữ số`),
  consent: z.literal(true, { error: 'Cần đồng ý thì mới tham gia được' }),
  /** S44 (PRODUCT.md §7.39a): the separate, optional tick. Absent = false; it is never required to join. */
  teachingConsent: z.boolean({ error: 'Lựa chọn dùng làm ví dụ không hợp lệ' }).optional().default(false),
});

/** POST /api/rooms/resolve: a room code now leads to a session or to a training. */
export type ResolvedRoom = ({ kind: 'session' } & ActiveSession) | { kind: 'training'; id: number; title: string };

/** `stopped_sending`: the member pressed "Dừng gửi" while the training was open (PRODUCT.md §7.35j); what they sent stays until the mentor approves its deletion. */
export type TrainingConnection = 'waiting' | 'connected' | 'uninstalled' | 'stopped_sending';
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

/** Behaviour hints for the mentor (PRODUCT.md §7.35c): they describe what happened, never the person, and are not a score. */
export const FLAG_CODES = [
  'repeated_failure', 'long_without_verify', 'edited_not_verified', 'auto_accept', 'fast_approvals',
  'repeated_request', 'auto_compact_repeated', 'dangerous_command', 'touches_tests', 'possible_secret',
] as const;
export type FlagCode = (typeof FLAG_CODES)[number];

/** Names a behaviour, never the person, and never a verdict. Shared by the mentor's screen and the exported report. */
export const FLAG_LABELS: Record<FlagCode, string> = {
  repeated_failure: 'Lặp lệnh lỗi',
  long_without_verify: 'Lâu chưa qua kiểm tra',
  edited_not_verified: 'Sửa xong chưa chạy kiểm tra',
  auto_accept: 'Chế độ tự chấp nhận',
  fast_approvals: 'Đồng ý quyền rất nhanh',
  repeated_request: 'Lặp yêu cầu',
  auto_compact_repeated: 'Hội thoại tự nén nhiều lần',
  dangerous_command: 'Lệnh nguy hiểm',
  touches_tests: 'Đụng vào test',
  possible_secret: 'Có thể lộ bí mật',
};

/** A flag that is up, with the events that justify it (oldest first, capped), so the mentor can jump to them. */
export interface MemberFlag {
  code: FlagCode;
  eventIds: number[];
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
  /** The member pressed "Dừng gửi" while open: their data stays until the mentor approves deleting it (POST .../members/:memberId/purge). */
  stoppedSending: boolean;
  /** Flags that are up for this member (S39). */
  flags: FlagCode[];
  /** `/clear` (and exit) rows, `/compact` rows and permission requests seen so far. */
  clearCount: number;
  compactCount: number;
  permissionCount: number;
  /** The mentor's note for the report; null when there is none (S40). */
  mentorNote: string | null;
  /** Events of this member marked as examples for the report. */
  markedCount: number;
  /** S44: the member agreed to their prompts becoming teaching examples (the "Ví dụ" button is locked without it). Mentor screen only. */
  teachingConsent: boolean;
  /** S45: this member's AI drafts of teaching examples, by state. Mentor screen only. */
  exampleDrafts: ExampleDraftCounts;
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
  /** The mentor allowed auto-accept / bypass for this training: that flag never goes up. */
  allowAutoAccept: boolean;
  /** How many members have each flag. Numbers only: no names, no comparison (PRODUCT.md §7.35d). */
  flagCounts: Record<FlagCode, number>;
  /** When the mentor last downloaded the report; null if never (the "Kết thúc" prompt asks while it is null). */
  reportExportedAt: number | null;
  /** S44: examples never downloaded or saved after the last download; 0 when there are none. The "Kết thúc" prompt shows it. */
  unexportedExampleCount: number;
  /** S45: the mentor has set up the AI command, so "Làm ví dụ" can ask for a draft. Mentor screen only. */
  aiDraftAvailable: boolean;
  /** S45: drafts over the whole training; `next` is the unseen finished draft that finished first ("Nháp tiếp theo"). */
  exampleDrafts: ExampleDraftCounts & { next: { memberId: number; eventId: number } | null };
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

export const HOOK_EVENT_NAMES = [
  'UserPromptSubmit', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest', 'Notification', 'PreCompact', 'SessionEnd', 'PostModelSwitch',
] as const;
export type HookEventName = (typeof HOOK_EVENT_NAMES)[number];

export interface HookSettings {
  hooks: Record<HookEventName, HookEntry[]>;
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
  kind: 'prompt' | 'tool' | 'permission' | 'session' | 'notice';
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
  /** `AskUserQuestion` tool rows: "question → choice" pairs. `session` rows: the text typed after `/compact`, or "from → to". */
  note?: string;
  /** `session` and `notice` rows. */
  subtype?: string;
  /** `permission` rows: what the member did, inferred (never sent by Claude Code). */
  decision?: 'allowed' | 'denied' | 'pending';
  /** `permission` rows, `allowed` only: estimated milliseconds to decide. */
  decisionMs?: number;
  /** The `permission_mode` at that moment, when it is not `default`. */
  permissionMode?: string;
  /** The mentor picked this row as an example for the report. */
  marked: boolean;
  /** S44, `prompt` rows only: the row is a teaching example for the next course (the label is the example's, not the person's). */
  teachingExample: { label: TeachingLabel } | null;
  /** S45, `prompt` rows only: the state of the AI draft for the example button (`error` is the short reason of a failed draft). */
  exampleDraft: { status: ExampleDraftStatus; seen: boolean; suspicious: boolean; error: string | null } | null;
}

export interface TrainingEventsPage {
  /** Oldest first, at most 500. */
  events: TrainingEventRow[];
  hasMore: boolean;
  /** Flags of the member's whole timeline (not only this page), each with the events behind it. */
  flags: MemberFlag[];
}

// GET /api/admin/trainings/:id/events/:eventId/detail
export interface TrainingEventDetail {
  output: Clip | null;
  change: Clip | null;
}

// S41 (PRODUCT.md §7.36): export the raw data of a training as a zip, to be analysed with the mentor's own AI.

/** Biggest zip (before compression) the server builds; the mentor narrows the days or the members above it. */
export const TRAINING_EXPORT_MAX_BYTES = 50 * 1024 * 1024;

const exportDay = z
  .string({ error: 'Ngày phải có dạng YYYY-MM-DD' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD')
  .refine(s => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }, 'Ngày không tồn tại');

/**
 * GET /api/admin/trainings/:id/export/summary and /export.zip. No `from` and no `to` = today; `from` alone = that one day.
 * Days are the calendar days of the machine running the app (the mentor's). `members` is a comma-separated list of ids; absent = the whole class.
 */
export const TrainingExportQuery = z
  .object({
    from: exportDay.optional(),
    to: exportDay.optional(),
    members: z
      .string()
      .regex(/^\d+(,\d+)*$/, 'Danh sách bạn không hợp lệ')
      .transform(s => [...new Set(s.split(',').map(Number))])
      .optional(),
  })
  .refine(q => !(q.to && !q.from), { message: 'Chọn ngày bắt đầu', path: ['from'] })
  .refine(q => !(q.from && q.to && q.to < q.from), { message: 'Ngày kết thúc phải sau hoặc cùng ngày bắt đầu', path: ['to'] });
export type TrainingExportQuery = z.infer<typeof TrainingExportQuery>;

/** What the dialog shows before the file is built. `eventCount` 0 means there is nothing to download. */
export interface TrainingExportSummary {
  /** The days actually used (YYYY-MM-DD), after the defaults. */
  from: string;
  to: string;
  memberCount: number;
  eventCount: number;
  approxBytes: number;
  /** Above `TRAINING_EXPORT_MAX_BYTES`: the file would not be built. */
  tooLarge: boolean;
}

// S44 (PRODUCT.md §7.39): prompts the mentor picks as anonymous examples for the next course.

export const TEACHING_LABELS = ['good', 'needs_work'] as const;
export type TeachingLabel = (typeof TEACHING_LABELS)[number];
export const TEACHING_LABEL_TEXT: Record<TeachingLabel, string> = { good: 'Tốt', needs_work: 'Chưa tốt' };

/** The four groups of PRODUCT.md §7.35 plus "other". */
export const TEACHING_TOPICS = ['verify', 'delegation', 'stuck', 'risk', 'other'] as const;
export type TeachingTopic = (typeof TEACHING_TOPICS)[number];
export const TEACHING_TOPIC_TEXT: Record<TeachingTopic, string> = {
  verify: 'Kiểm chứng',
  delegation: 'Cách giao việc',
  stuck: 'Kẹt',
  risk: 'Hành vi rủi ro',
  other: 'Khác',
};

export const TEACHING_COMMENT_MAX = 2000;
export const TEACHING_TEXT_MAX = 4000;

const teachingText = (what: string) =>
  z
    .string({ error: `${what} không hợp lệ` })
    .refine(s => [...s].length <= TEACHING_TEXT_MAX, `${what} tối đa ${TEACHING_TEXT_MAX} ký tự`)
    .nullish()
    .transform(s => s ?? null);

// PUT /api/admin/trainings/:id/events/:eventId/teaching-example. Replaces the whole example; an absent or null field clears that field.
export const TeachingExampleBody = z.object({
  label: z.enum(TEACHING_LABELS, { error: 'Chọn nhãn: tốt hoặc chưa tốt' }),
  topic: z.enum(TEACHING_TOPICS, { error: 'Chủ đề không hợp lệ' }).optional().default('other'),
  comment: z
    .string({ error: 'Nhập nhận xét' })
    .transform(s => s.trim())
    .refine(s => s.length > 0, 'Nhận xét không được để trống')
    .refine(s => [...s].length <= TEACHING_COMMENT_MAX, `Nhận xét tối đa ${TEACHING_COMMENT_MAX} ký tự`),
  betterPrompt: teachingText('Phiên bản tốt hơn').transform(s => (s === null || s.trim() === '' ? null : s)),
  editedPrompt: teachingText('Prompt đã sửa'),
  editedContext: teachingText('Bối cảnh đã sửa'),
});
export type TeachingExampleBody = z.infer<typeof TeachingExampleBody>;

/** One example as the mentor's review screen shows it. Names the member: it never leaves the mentor's screen. */
export interface TeachingExampleRow {
  eventId: number;
  memberId: number;
  memberName: string;
  label: TeachingLabel;
  topic: TeachingTopic;
  comment: string;
  betterPrompt: string | null;
  editedPrompt: string | null;
  editedContext: string | null;
  /** The mentor marked it reviewed ("Đã rà ví dụ này"); any change of content clears it. */
  reviewed: boolean;
  /** The prompt and the turn's commands as they would go in the file when not edited (secrets already masked). */
  defaultPrompt: string;
  defaultContext: string;
  updatedAt: number;
}

// GET /api/admin/trainings/:id/teaching-examples
export interface TeachingExamplesResponse {
  examples: TeachingExampleRow[];
}

/** The example just saved (PUT). */
export type TeachingExample = TeachingExampleRow;

// S45 (PRODUCT.md §7.40): an AI draft of a teaching example, written in the background. Mentor screen only (`/api/admin/*`).

export const EXAMPLE_DRAFT_STATUSES = ['queued', 'running', 'done', 'failed'] as const;
export type ExampleDraftStatus = (typeof EXAMPLE_DRAFT_STATUSES)[number];

/** Drafts by state: `drafting` = queued or running; `unseen` = done and not opened yet; `failed`. */
export interface ExampleDraftCounts {
  drafting: number;
  unseen: number;
  failed: number;
}

/** What the AI wrote. The label is only a suggestion: the mentor still picks it. */
export interface ExampleDraftContent {
  label: TeachingLabel;
  topic: TeachingTopic;
  comment: string;
  betterPrompt: string | null;
  suspicious: boolean;
  suspiciousReason: string;
  /** Exact words of the prompt the AI took as aimed at the reviewer (at most 200 characters); empty when none or not found in the prompt. */
  suspiciousQuote: string;
}

/** POST (202) / GET /api/admin/trainings/:id/events/:eventId/example-draft */
export interface ExampleDraftRow {
  eventId: number;
  status: ExampleDraftStatus;
  /** Only when `done`. */
  draft: ExampleDraftContent | null;
  /** How many examples of the mentor the AI read; only when `done`. */
  sampleCount: number | null;
  /** Short Vietnamese reason; only when `failed`. */
  error: string | null;
  seen: boolean;
  /** ISO 8601 time of the request (the dialog counts the seconds from it). */
  createdAt: string;
}
