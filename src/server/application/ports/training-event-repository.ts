import type { ExampleDraftStatus, TeachingLabel, TeachingTopic } from '../../../shared/api/training.js';
import type { Clip } from '../../domain/training/clip.js';
import type { ExportEvent } from '../../domain/training/export.js';
import type { EventSkeleton } from '../../domain/training/export-selection.js';
import type { ExampleDraftResult, ExampleFields, ExampleOrigin } from '../../domain/training/example-draft.js';
import type { FlagEvent } from '../../domain/training/flags/flag-event.js';
import type { TrainingEventDraft } from '../../domain/training/training-event.js';

/** A filtered hook call, stamped with whose it is and when it arrived. */
export type NewTrainingEvent = TrainingEventDraft & { memberId: number; receivedAt: Date };

/** How much of the end of an output the list may read: enough for a one-line summary, never the whole output. */
export const OUTPUT_END_CHARS = 1000;

/** One line of the timeline, read without `output_*` / `change_*` in full. Every kind is listed (S39). */
export interface LightEvent {
  id: number;
  kind: 'prompt' | 'tool' | 'permission' | 'session' | 'notice';
  receivedAt: Date;
  claudeSessionId: string;
  prompt: string | null;
  toolName: string | null;
  toolTarget: string | null;
  ok: boolean | null;
  durationMs: number | null;
  errorExcerpt: string | null;
  note: string | null;
  subtype: string | null;
  permissionMode: string | null;
  /** Last `OUTPUT_END_CHARS` characters of the stored output (null if there is none). */
  outputEnd: string | null;
  hasOutput: boolean;
  hasChange: boolean;
  /** The mentor picked it as an example for the report. */
  marked: boolean;
  /** S44: the label when the prompt is a teaching example, else null. */
  teachingLabel: TeachingLabel | null;
}

/** A teaching example as stored (S44). The texts the mentor edited are null until edited. */
export interface TeachingExampleRecord {
  eventId: number;
  label: TeachingLabel;
  topic: TeachingTopic;
  comment: string;
  betterPrompt: string | null;
  editedPrompt: string | null;
  editedContext: string | null;
  /** The mentor's "Đã rà ví dụ này"; null = not reviewed (any change of content clears it). */
  reviewedAt: Date | null;
  updatedAt: Date;
  /** S45: the AI draft this example started from, as the AI wrote it; null when there was none. Never shown, only kept. */
  aiDraft: ExampleFields | null;
  /** S45: who wrote it. Changing `aiDraft` or `origin` alone never touches `reviewedAt` or `updatedAt`. */
  origin: ExampleOrigin;
}

/** S45: the AI draft of one prompt, as stored (one per prompt; asking again overwrites it). The content fields are set once `done`. */
export interface ExampleDraftRecord {
  eventId: number;
  status: ExampleDraftStatus;
  label: TeachingLabel | null;
  topic: TeachingTopic | null;
  comment: string | null;
  betterPrompt: string | null;
  suspicious: boolean;
  suspiciousReason: string | null;
  suspiciousQuote: string | null;
  sampleCount: number | null;
  error: string | null;
  seenAt: Date | null;
  createdAt: Date;
  finishedAt: Date | null;
}

/** A draft in the lists: enough for the buttons and the counts, with the member it belongs to. */
export interface ExampleDraftSummary {
  eventId: number;
  memberId: number;
  status: ExampleDraftStatus;
  seen: boolean;
  suspicious: boolean;
  error: string | null;
  finishedAt: Date | null;
}

/** Whose event it is: enough to check it belongs to the training in the URL and to the right member. */
export interface EventOwner {
  trainingId: number;
  memberId: number;
  kind: LightEvent['kind'];
}

/** A marked event with the member it belongs to. */
export type MarkedEvent = LightEvent & { memberId: number };

/** What the mentor opens with "Xem". `trainingId` lets the caller check the event belongs to the training in the URL. */
export interface EventDetail {
  trainingId: number;
  output: Clip | null;
  change: Clip | null;
}

export interface MemberCounts {
  promptCount: number;
  toolCount: number;
  failedCount: number;
  clearCount: number;
  compactCount: number;
  permissionCount: number;
  /** Events of the member the mentor marked as examples. */
  markedCount: number;
  /** Id of the member's newest event: a cheap "did anything change" key for what is derived from the whole timeline. */
  lastEventId: number;
}

export { FLAG_TEXT_CHARS } from '../../domain/training/flags/flag-event.js';

/** Read side: usable outside a unit of work. */
export interface TrainingEventReader {
  /** Events of one member with `id > afterId`, oldest first. */
  listLight(memberId: number, afterId: number, limit: number): Promise<LightEvent[]>;
  getDetail(eventId: number): Promise<EventDetail | null>;
  /** Every event of the member, oldest first, with bounded text, for the flag rules, the inferred permission decisions and "possibly stuck" (all read per Claude Code session). */
  listForFlags(memberId: number): Promise<FlagEvent[]>;
  /** Counts per member of the training; members with no events are absent. */
  countsByMember(trainingId: number): Promise<Map<number, MemberCounts>>;
  /** The events of the training the mentor marked, oldest first (no output and no change: the report never carries them). */
  listMarked(trainingId: number): Promise<MarkedEvent[]>;
  /** Every event of the member, oldest first, with no text: which turn and which session each belongs to (S43). */
  listEventSkeleton(memberId: number): Promise<EventSkeleton[]>;
  /** These events of the member (ids from `listEventSkeleton`), oldest first, with the output and the change whole as stored (S41). */
  listForExportByIds(memberId: number, ids: readonly number[]): Promise<ExportEvent[]>;
  /** Who the event belongs to; null when there is no such event (S44). */
  getEventOwner(eventId: number): Promise<EventOwner | null>;
  getTeachingExample(eventId: number): Promise<TeachingExampleRecord | null>;
  /** S45: the draft of a prompt; null when there is none. */
  getExampleDraft(eventId: number): Promise<ExampleDraftRecord | null>;
  /** S45: every draft of the training with the member it belongs to, by event id. */
  listExampleDrafts(trainingId: number): Promise<ExampleDraftSummary[]>;
  /** Every teaching example of the training with the member it belongs to, by event id (S44). */
  listTeachingExamples(trainingId: number): Promise<(TeachingExampleRecord & { memberId: number })[]>;
  /** Per member of the training: the events received in `[from, to)` and roughly how many bytes of text they carry. Members with none are absent. */
  exportStats(trainingId: number, range: { from: Date; to: Date }): Promise<Map<number, ExportStats>>;
}

export interface ExportStats {
  eventCount: number;
  approxBytes: number;
}

/** Write side: only reachable inside a unit of work (see `TrainingUnitContext`). */
export interface TrainingEventRepository extends TrainingEventReader {
  append(event: NewTrainingEvent): Promise<void>;
  /** Marks or unmarks an event; doing it twice changes nothing. */
  setMark(eventId: number, marked: boolean): Promise<void>;
  /** Creates or replaces the example of a prompt (S44). */
  saveTeachingExample(example: TeachingExampleRecord): Promise<void>;
  /** Sets or clears the review mark without touching the content or `updated_at`. */
  setTeachingReviewed(eventId: number, at: Date | null): Promise<void>;
  /** Drops the example; doing it twice changes nothing. */
  deleteTeachingExample(eventId: number): Promise<void>;
  /** Changes only where an example came from; `reviewed_at` and `updated_at` stay (S45). */
  setTeachingOrigin(eventId: number, aiDraft: ExampleFields | null, origin: ExampleOrigin): Promise<void>;
  /** A fresh `queued` draft for the prompt, replacing any earlier one (S45). */
  queueExampleDraft(eventId: number, at: Date): Promise<ExampleDraftRecord>;
  markExampleDraftRunning(eventId: number): Promise<void>;
  completeExampleDraft(eventId: number, draft: ExampleDraftResult, sampleCount: number, at: Date): Promise<void>;
  failExampleDraft(eventId: number, error: string, at: Date): Promise<void>;
  /** Sets `seen_at` once (a later call keeps the first time). */
  markExampleDraftSeen(eventId: number, at: Date): Promise<void>;
  /** Drops the draft; doing it twice changes nothing. */
  deleteExampleDraft(eventId: number): Promise<void>;
  /** At startup: drafts left queued/running by a previous process become failed. Returns how many. */
  failUnfinishedExampleDrafts(error: string, at: Date): Promise<number>;
}
