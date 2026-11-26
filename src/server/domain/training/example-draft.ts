import { TEACHING_LABELS, TEACHING_TOPICS, type ExampleDraftCounts, type ExampleDraftStatus, type TeachingLabel, type TeachingTopic } from '../../../shared/api/training.js';
import { maskForExample } from './teaching-examples.js';

// AI drafts of teaching examples (PRODUCT.md §7.40, docs/architecture.md §11.12). A draft is never a saved example: the mentor reads it,
// edits it and saves it. Nothing here knows a member name, an id (other than the event ids it is given) or a time.

export const EARLIER_PROMPTS_MAX = 2;
export const SAMPLE_PROMPT_CHARS = 1500;
export const SAMPLES_MAX_CHARS = 40_000;
export const DRAFT_COMMENT_MAX = 1000;
export const DRAFT_BETTER_PROMPT_MAX = 4000;
export const SUSPICIOUS_QUOTE_MAX = 200;
const CUT_MARK = '…(đã cắt)';

/** Where an example came from (stored with it, never shown on the review screen or in the file). */
export type ExampleOrigin = 'mentor' | 'ai_kept' | 'ai_edited';

/** The four things the AI drafts and the mentor saves; also what is kept next to a saved example as `ai_draft`. */
export interface ExampleFields {
  label: TeachingLabel;
  topic: TeachingTopic;
  comment: string;
  betterPrompt: string | null;
}

/** One finished example of the mentor, as the AI sees it: no name, no id, no time. */
export interface ExampleSample {
  prompt: string;
  turnActivity: string;
  label: TeachingLabel;
  topic: TeachingTopic;
  comment: string;
  betterPrompt: string | null;
}

/** What the drafter returns before the domain checks it. */
export interface RawExampleDraft {
  label: string;
  topic: string;
  comment: string;
  betterPrompt: string;
  suspicious: boolean;
  suspiciousReason: string;
  suspiciousQuote: string;
  model: string | null;
}

/** A draft that passed `normalizeExampleDraft`. */
export interface ExampleDraftResult extends ExampleFields {
  suspicious: boolean;
  suspiciousReason: string;
  suspiciousQuote: string;
}

/** Raised when the drafter's answer is not usable: the run fails with "AI trả kết quả không hợp lệ". */
export class InvalidExampleDraftError extends Error {}

const clipChars = (text: string, max: number, mark = ''): string => {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max).join('')}${mark}`;
};

/** The events of one member, oldest first; only what the prompts need. */
export interface DraftTimelineEvent {
  id: number;
  kind: string;
  claudeSessionId: string;
  prompt: string | null;
}

/**
 * Up to `n` prompts the member sent right before `eventId` in the same Claude Code session (S43's grouping), oldest first. Each is masked
 * and cut to 1 500 characters (with a mark). A prompt of another session never counts, even when it came just before. Unknown event: none.
 */
export function earlierPromptsInSession(events: readonly DraftTimelineEvent[], eventId: number, n = EARLIER_PROMPTS_MAX): string[] {
  const at = events.findIndex(e => e.id === eventId && e.kind === 'prompt');
  if (at < 0) return [];
  const session = events[at]!.claudeSessionId;
  return events
    .slice(0, at)
    .filter(e => e.kind === 'prompt' && e.claudeSessionId === session && e.prompt !== null)
    .slice(-n)
    .map(e => clipChars(maskForExample(e.prompt!), SAMPLE_PROMPT_CHARS, CUT_MARK));
}

/** A saved example with what the sample needs: both the texts the mentor edited and the masked originals. */
export interface SampleCandidate extends ExampleFields {
  eventId: number;
  origin: ExampleOrigin;
  updatedAt: Date;
  editedPrompt: string | null;
  editedContext: string | null;
  defaultPrompt: string;
  defaultContext: string;
}

const sampleSize = (s: ExampleSample) => s.prompt.length + s.turnActivity.length + s.comment.length + (s.betterPrompt?.length ?? 0);

/**
 * The examples the AI learns the mentor's standard from: every finished example of the training except the one being drafted and the
 * ones kept as the AI wrote them (they would teach the AI its own words), newest first (`updatedAt`), with the real label mix (no
 * balancing). The reviewed text wins over the masked original. Stops adding at `maxChars` in total: older examples are dropped.
 * This is only a safety net; a lasting example store (option B) will need a smarter choice.
 */
export function pickSamples(candidates: readonly SampleCandidate[], excludeEventId: number, maxChars = SAMPLES_MAX_CHARS): ExampleSample[] {
  const newestFirst = candidates
    .filter(c => c.origin !== 'ai_kept' && c.eventId !== excludeEventId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.eventId - a.eventId);
  const out: ExampleSample[] = [];
  let total = 0;
  for (const c of newestFirst) {
    const sample: ExampleSample = {
      prompt: clipChars(maskForExample(c.editedPrompt ?? c.defaultPrompt), SAMPLE_PROMPT_CHARS, CUT_MARK),
      turnActivity: maskForExample(c.editedContext ?? c.defaultContext),
      label: c.label,
      topic: c.topic,
      comment: c.comment,
      betterPrompt: c.betterPrompt,
    };
    total += sampleSize(sample);
    if (total > maxChars) break;
    out.push(sample);
  }
  return out;
}

/**
 * Checks the drafter's answer and cuts it to what a saved example allows. `maskedPrompt` is the prompt as the AI saw it: the quote of the
 * suspicious words is kept only when it appears in it word for word (the screen highlights it there).
 */
export function normalizeExampleDraft(raw: RawExampleDraft, maskedPrompt: string): ExampleDraftResult {
  if (!(TEACHING_LABELS as readonly string[]).includes(raw.label)) throw new InvalidExampleDraftError('label');
  if (!(TEACHING_TOPICS as readonly string[]).includes(raw.topic)) throw new InvalidExampleDraftError('topic');
  const comment = raw.comment.trim();
  if (comment === '') throw new InvalidExampleDraftError('comment');
  const better = raw.betterPrompt.trim();
  const reason = raw.suspicious ? raw.suspiciousReason.trim() : '';
  const quote = raw.suspicious ? raw.suspiciousQuote.trim() : '';
  return {
    label: raw.label as TeachingLabel,
    topic: raw.topic as TeachingTopic,
    comment: clipChars(comment, DRAFT_COMMENT_MAX),
    betterPrompt: better === '' ? null : clipChars(better, DRAFT_BETTER_PROMPT_MAX),
    suspicious: raw.suspicious,
    suspiciousReason: reason,
    suspiciousQuote: quote !== '' && [...quote].length <= SUSPICIOUS_QUOTE_MAX && maskedPrompt.includes(quote) ? quote : '',
  };
}

/**
 * Where a saved example came from, by comparing it with the AI draft: no draft = the mentor's own; all four fields the same (the
 * comment trimmed, a missing better prompt the same as an empty one) = kept as the AI wrote it; anything else = the AI's, edited.
 */
export function exampleOrigin(saved: ExampleFields, aiDraft: ExampleFields | null): ExampleOrigin {
  if (!aiDraft) return 'mentor';
  const same =
    saved.label === aiDraft.label &&
    saved.topic === aiDraft.topic &&
    saved.comment.trim() === aiDraft.comment.trim() &&
    (saved.betterPrompt ?? '') === (aiDraft.betterPrompt ?? '');
  return same ? 'ai_kept' : 'ai_edited';
}

/** What the counts need from a draft. */
export interface DraftCountable {
  eventId: number;
  memberId: number;
  status: ExampleDraftStatus;
  seen: boolean;
  finishedAt: Date | null;
}

/**
 * Drafts by state, per member and for the whole training: `drafting` = queued or running, `unseen` = done and not opened yet, `failed`.
 * `next` is the unseen finished draft that finished first (ties: the lower event id), for "Nháp tiếp theo".
 */
export function countDrafts(drafts: readonly DraftCountable[]): { total: ExampleDraftCounts; byMember: Map<number, ExampleDraftCounts>; next: { memberId: number; eventId: number } | null } {
  const total: ExampleDraftCounts = { drafting: 0, unseen: 0, failed: 0 };
  const byMember = new Map<number, ExampleDraftCounts>();
  let next: DraftCountable | null = null;
  const at = (d: DraftCountable) => d.finishedAt?.getTime() ?? 0;
  for (const d of drafts) {
    const mine = byMember.get(d.memberId) ?? { drafting: 0, unseen: 0, failed: 0 };
    const key = d.status === 'queued' || d.status === 'running' ? 'drafting' : d.status === 'failed' ? 'failed' : d.seen ? null : 'unseen';
    if (key) {
      mine[key]++;
      total[key]++;
    }
    byMember.set(d.memberId, mine);
    if (key === 'unseen' && (next === null || at(d) < at(next) || (at(d) === at(next) && d.eventId < next.eventId))) next = d;
  }
  return { total, byMember, next: next ? { memberId: next.memberId, eventId: next.eventId } : null };
}
