import type { Clip } from '../../domain/training/clip.js';
import type { ExportEvent } from '../../domain/training/export.js';
import type { FlagEvent } from '../../domain/training/flags/flag-event.js';
import type { ToolOutcome } from '../../domain/training/is-stuck.js';
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
  /** Every event of the member, oldest first, with bounded text, for the flag rules and the inferred permission decisions. */
  listForFlags(memberId: number): Promise<FlagEvent[]>;
  /** The member's last `n` tool calls, oldest first. */
  recentTools(memberId: number, n: number): Promise<ToolOutcome[]>;
  /** Counts per member of the training; members with no events are absent. */
  countsByMember(trainingId: number): Promise<Map<number, MemberCounts>>;
  /** The events of the training the mentor marked, oldest first (no output and no change: the report never carries them). */
  listMarked(trainingId: number): Promise<MarkedEvent[]>;
  /** One member's events received in `[from, to)`, oldest first, with the output and the change whole as stored (S41). */
  listForExport(memberId: number, range: { from: Date; to: Date }): Promise<ExportEvent[]>;
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
}
