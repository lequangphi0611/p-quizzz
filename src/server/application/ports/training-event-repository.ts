import type { Clip } from '../../domain/training/clip.js';
import type { ToolOutcome } from '../../domain/training/is-stuck.js';
import type { TrainingEventDraft } from '../../domain/training/training-event.js';

/** A filtered hook call, stamped with whose it is and when it arrived. */
export type NewTrainingEvent = TrainingEventDraft & { memberId: number; receivedAt: Date };

/** How much of the end of an output the list may read: enough for a one-line summary, never the whole output. */
export const OUTPUT_END_CHARS = 1000;

/** One line of the timeline, read without `output_*` / `change_*` in full. */
export interface LightEvent {
  id: number;
  kind: 'prompt' | 'tool';
  receivedAt: Date;
  claudeSessionId: string;
  prompt: string | null;
  toolName: string | null;
  toolTarget: string | null;
  ok: boolean | null;
  durationMs: number | null;
  errorExcerpt: string | null;
  /** Last `OUTPUT_END_CHARS` characters of the stored output (null if there is none). */
  outputEnd: string | null;
  hasOutput: boolean;
  hasChange: boolean;
}

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
}

/** Read side: usable outside a unit of work. */
export interface TrainingEventReader {
  /** Events of one member with `id > afterId`, oldest first. */
  listLight(memberId: number, afterId: number, limit: number): Promise<LightEvent[]>;
  getDetail(eventId: number): Promise<EventDetail | null>;
  /** The member's last `n` tool calls, oldest first. */
  recentTools(memberId: number, n: number): Promise<ToolOutcome[]>;
  /** Counts per member of the training; members with no events are absent. */
  countsByMember(trainingId: number): Promise<Map<number, MemberCounts>>;
}

/** Write side: only reachable inside a unit of work (see `TrainingUnitContext`). */
export interface TrainingEventRepository extends TrainingEventReader {
  append(event: NewTrainingEvent): Promise<void>;
}
