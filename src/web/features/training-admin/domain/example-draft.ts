import { TEACHING_LABEL_TEXT, type ExampleDraftContent, type ExampleDraftCounts, type ExampleDraftStatus, type TrainingEventRow } from '../../../../shared/api/index.js';
import { teachingFormError, type TeachingForm } from './teaching.js';

// S45 (PRODUCT.md §7.40): the AI writes a draft of a teaching example in the background; the mentor reads, edits and saves it. Pure rules
// for the example button, the fields of the dialog and the footer. The label of the AI is only a hint: the mentor always picks it.

export const isDrafting = (s: ExampleDraftStatus): boolean => s === 'queued' || s === 'running';

// ── The button on a prompt ───────────────────────────────────────────────────────────────────────────

export type ExampleButtonKind = 'new' | 'drafting' | 'unseen' | 'unseenSuspect' | 'unsaved' | 'failed' | 'savedGood' | 'savedNeedsWork';

export interface ExampleButtonView {
  kind: ExampleButtonKind;
  text: string;
  icon: string;
  /** The AI flagged the prompt (shield icon instead of sparkles, warning colours). */
  suspect: boolean;
  /** Tooltip: the short reason of a failed draft, or what a click does. */
  title: string;
  /** The icon turns (not under reduced motion: a still hourglass is drawn then). */
  spin: boolean;
}

/** The look of the example button of a prompt: a draft (if any) wins over a saved example, which wins over "Làm ví dụ". Icon and words, never colour alone. */
export function exampleButtonView(event: Pick<TrainingEventRow, 'exampleDraft' | 'teachingExample'>, reducedMotion = false): ExampleButtonView {
  const d = event.exampleDraft;
  if (d) {
    if (isDrafting(d.status)) {
      return { kind: 'drafting', text: 'Đang viết nháp…', icon: reducedMotion ? 'hourglass' : 'loader-circle', suspect: false, title: 'AI đang viết nháp, bấm để mở', spin: !reducedMotion };
    }
    if (d.status === 'failed') return { kind: 'failed', text: 'Nháp lỗi', icon: 'circle-alert', suspect: false, title: d.error ?? 'Không viết được nháp', spin: false };
    if (!d.seen) {
      return d.suspicious
        ? { kind: 'unseenSuspect', text: 'Xem nháp · nghi ngờ', icon: 'shield-alert', suspect: true, title: 'Có nháp AI chưa xem, bị đánh dấu nghi ngờ', spin: false }
        : { kind: 'unseen', text: 'Xem nháp', icon: 'sparkles', suspect: false, title: 'Có nháp AI chưa xem', spin: false };
    }
    return { kind: 'unsaved', text: 'Nháp chưa lưu', icon: d.suspicious ? 'shield-alert' : 'sparkles', suspect: d.suspicious, title: 'Mở lại nháp chưa lưu', spin: false };
  }
  const label = event.teachingExample?.label;
  if (label === 'good') return { kind: 'savedGood', text: `Ví dụ: ${TEACHING_LABEL_TEXT.good}`, icon: 'circle-check', suspect: false, title: 'Sửa hoặc bỏ ví dụ', spin: false };
  if (label === 'needs_work') return { kind: 'savedNeedsWork', text: `Ví dụ: ${TEACHING_LABEL_TEXT.needs_work}`, icon: 'rotate-ccw', suspect: false, title: 'Sửa hoặc bỏ ví dụ', spin: false };
  return { kind: 'new', text: 'Làm ví dụ', icon: 'graduation-cap', suspect: false, title: 'Chọn prompt này làm ví dụ', spin: false };
}

/** "prompt 2 của Mai": what a screen reader needs to tell the buttons of different prompts apart. */
export const promptContext = (number: number | null, memberName: string): string => `${number === null ? 'prompt' : `prompt ${number}`} của ${memberName}`;

/** The name of the button: its words first (so voice control and the visible label agree), then whose prompt it is and, for a failure, why. */
export function exampleButtonName(view: ExampleButtonView, context: string, error: string | null): string {
  return `${view.text}, ${context}${view.kind === 'failed' && error ? `: ${error}` : ''}`;
}

// ── Counts and the way to the next draft ──────────────────────────────────────────────────────────────

export const hasDraftActivity = (c: ExampleDraftCounts): boolean => c.drafting + c.unseen + c.failed > 0;

/** "3 nháp chưa xem · 1 đang viết · 1 lỗi" as parts (the number first, to draw it in bold); the cluster is hidden when all three are 0. */
export function draftSummaryParts(c: ExampleDraftCounts): { unseen: number; rest: string[] } | null {
  if (!hasDraftActivity(c)) return null;
  const rest: string[] = [];
  if (c.drafting > 0) rest.push(`${c.drafting} đang viết`);
  if (c.failed > 0) rest.push(`${c.failed} lỗi`);
  return { unseen: c.unseen, rest };
}

/** What the chip of a member says to a screen reader, after the name: "2 nháp chưa xem, 1 đang viết, 1 lỗi". */
export function memberDraftSpeech(c: ExampleDraftCounts): string {
  const parts: string[] = [];
  if (c.unseen > 0) parts.push(`${c.unseen} nháp chưa xem`);
  if (c.drafting > 0) parts.push(`${c.drafting} đang viết`);
  if (c.failed > 0) parts.push(`${c.failed} lỗi`);
  return parts.join(', ');
}

// ── Words for a screen reader (aria-live="polite", one sentence per event) ───────────────────────────────

export const draftStartedNote = (number: number | null, name: string): string => `Đang viết nháp cho ${promptContext(number, name)}.`;
export const draftReadyNote = (number: number | null, name: string): string => `Nháp cho ${promptContext(number, name)} đã sẵn sàng.`;
export const draftFailedNote = (number: number | null, name: string, reason: string): string => `Viết nháp cho ${promptContext(number, name)} bị lỗi: ${reason}.`;

// ── The fields of the dialog ───────────────────────────────────────────────────────────────────────────

export type DraftField = 'topic' | 'comment' | 'betterPrompt';
export const DRAFT_FIELDS: readonly DraftField[] = ['topic', 'comment', 'betterPrompt'];
export const DRAFT_FIELD_NAME: Record<DraftField, string> = { topic: 'Chủ đề', comment: 'Nhận xét', betterPrompt: 'Phiên bản tốt hơn' };

/** What the dialog put into the fields from a draft. `key` tells one draft from the next (the request time), so the same one is not applied twice. */
export interface AppliedDraft {
  key: string;
  topic: TeachingForm['topic'];
  comment: string;
  betterPrompt: string;
}

export const appliedOf = (key: string, d: ExampleDraftContent): AppliedDraft => ({ key, topic: d.topic, comment: d.comment, betterPrompt: d.betterPrompt ?? '' });

export type FieldOrigin = 'ai' | 'edited' | 'none';

/** Where a field stands: still the draft word for word (`ai`), changed by a single character (`edited`), or there is no draft (`none`). Browser only. */
export function fieldOrigin(field: DraftField, form: TeachingForm, applied: AppliedDraft | null): FieldOrigin {
  if (!applied) return 'none';
  return form[field] === applied[field] ? 'ai' : 'edited';
}

/** The fields still equal to the draft ("còn nguyên nháp"). Only information: it never blocks "Lưu". */
export const untouchedFields = (form: TeachingForm, applied: AppliedDraft | null): DraftField[] => DRAFT_FIELDS.filter(f => fieldOrigin(f, form, applied) === 'ai');

/**
 * The fields the mentor typed in, which a new draft must not replace without asking. Before any draft: a text field with something in it,
 * the topic once it was changed. After one: a field that differs from what that draft put there (an emptied text field has nothing to lose).
 */
export function typedFields(form: TeachingForm, applied: AppliedDraft | null, topicTouched: boolean): DraftField[] {
  return DRAFT_FIELDS.filter(f => {
    if (f === 'topic') return applied ? form.topic !== applied.topic : topicTouched;
    return form[f].trim() !== '' && (!applied || form[f] !== applied[f]);
  });
}

/** The fields a draft would overwrite: the typed ones whose text differs from the draft. */
export const overwriteFields = (form: TeachingForm, applied: AppliedDraft | null, topicTouched: boolean, draft: ExampleDraftContent): DraftField[] => {
  const next = appliedOf('', draft);
  return typedFields(form, applied, topicTouched).filter(f => form[f] !== next[f]);
};

/** The form with the draft poured in: every field except `keep`. The label is never touched (the AI only suggests it). */
export function applyDraft(form: TeachingForm, draft: ExampleDraftContent, keep: readonly DraftField[] = []): TeachingForm {
  const next = appliedOf('', draft);
  return {
    ...form,
    topic: keep.includes('topic') ? form.topic : next.topic,
    comment: keep.includes('comment') ? form.comment : next.comment,
    betterPrompt: keep.includes('betterPrompt') ? form.betterPrompt : next.betterPrompt,
  };
}

/** "Chủ đề, Nhận xét": the fields named in the overwrite question and in the footer. */
export const fieldNames = (fields: readonly DraftField[]): string => fields.map(f => DRAFT_FIELD_NAME[f]).join(', ');

/** "AI dựa trên N ví dụ bạn đã chốt trong buổi này", or the plain-standard line when there were none. */
export function draftBasisText(sampleCount: number | null): string {
  if (sampleCount === null) return '';
  return sampleCount === 0
    ? 'Chưa có ví dụ nào bạn đã chốt trong buổi này, AI dùng chuẩn chung'
    : `AI dựa trên ${sampleCount} ví dụ bạn đã chốt trong buổi này`;
}

// ── Saving ───────────────────────────────────────────────────────────────────────────────────────────

export interface SaveGate {
  form: TeachingForm;
  /** The draft has `suspicious = true`. */
  suspicious: boolean;
  /** "Đã đọc kỹ prompt" is ticked. */
  ack: boolean;
}

/** Why "Lưu ví dụ" is locked, or '' when it is open: a label must be chosen, a flagged prompt needs the tick, then the form's own rules (comment). */
export function saveBlockedReason(g: SaveGate): string {
  if (g.suspicious && !g.ack) return 'Tick “Đã đọc kỹ prompt” để lưu';
  return teachingFormError(g.form);
}

export const saveEnabled = (g: SaveGate): boolean => g.form.label !== '' && !(g.suspicious && !g.ack) && teachingFormError(g.form) === '';

export interface FooterView { text: string; icon: 'sparkles' | 'lock'; warn: boolean }

/**
 * The line at the bottom of the dialog. Locked: why. Open with a draft: which fields are still the draft word for word (information only).
 * Without a draft: why it is locked, as in S44.
 */
export function footerView(g: SaveGate, applied: AppliedDraft | null): FooterView | null {
  const untouched = untouchedFields(g.form, applied);
  const locked = !saveEnabled(g);
  if (g.suspicious && !g.ack) return { text: saveBlockedReason(g), icon: 'lock', warn: true };
  if (locked) {
    const why = g.form.label === '' ? 'Chọn nhãn để lưu' : saveBlockedReason(g);
    const more = applied && untouched.length > 0 ? ` · ${untouched.length} ô còn nguyên nháp` : '';
    return { text: `${why}${more}`, icon: 'lock', warn: false };
  }
  if (applied && untouched.length > 0) return { text: `Còn nguyên nháp: ${fieldNames(untouched)}`, icon: 'sparkles', warn: false };
  return null;
}

// ── The prompt with the flagged words marked ──────────────────────────────────────────────────────────

export interface QuoteSegment { text: string; mark: boolean }

/** The prompt cut around `quote` (found word for word, the first time); not found, or empty: the prompt whole and nothing marked. */
export function quoteSegments(prompt: string, quote: string): QuoteSegment[] {
  const at = quote === '' ? -1 : prompt.indexOf(quote);
  if (at < 0) return [{ text: prompt, mark: false }];
  const out: QuoteSegment[] = [];
  if (at > 0) out.push({ text: prompt.slice(0, at), mark: false });
  out.push({ text: quote, mark: true });
  if (at + quote.length < prompt.length) out.push({ text: prompt.slice(at + quote.length), mark: false });
  return out;
}
