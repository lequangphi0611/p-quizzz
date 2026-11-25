import {
  TEACHING_LABELS, TEACHING_TOPICS, TEACHING_COMMENT_MAX, TEACHING_TEXT_MAX, type TeachingExampleBody, type TeachingExampleRow, type TeachingLabel, type TeachingTopic, type TrainingMemberRow,
} from '../../../../shared/api/index.js';
import { slugOf } from './report.js';

// Teaching examples (PRODUCT.md §7.39): the mentor labels a prompt, writes a comment, then reviews and exports an anonymous file.

/** Why the button of a prompt is locked, or null when the member agreed. */
export const NO_CONSENT_REASON = 'Bạn này không đồng ý cho dùng làm ví dụ';

export function teachingLockReason(member: Pick<TrainingMemberRow, 'teachingConsent'>): string | null {
  return member.teachingConsent ? null : NO_CONSENT_REASON;
}

/** What the mentor fills in the dialog. `label` is empty until chosen (it is required). */
export interface TeachingForm {
  label: TeachingLabel | '';
  topic: TeachingTopic;
  comment: string;
  betterPrompt: string;
}

export const emptyTeachingForm = (): TeachingForm => ({ label: '', topic: 'other', comment: '', betterPrompt: '' });

export const formFromRow = (r: Pick<TeachingExampleRow, 'label' | 'topic' | 'comment' | 'betterPrompt'>): TeachingForm => ({
  label: r.label, topic: r.topic, comment: r.comment, betterPrompt: r.betterPrompt ?? '',
});

/** Why the form cannot be saved yet (empty when it can). Same rules as the server. */
export function teachingFormError(f: TeachingForm): string {
  if (f.label === '') return 'Chọn nhãn: tốt hoặc chưa tốt';
  if (f.comment.trim() === '') return 'Viết nhận xét';
  if ([...f.comment.trim()].length > TEACHING_COMMENT_MAX) return `Nhận xét tối đa ${TEACHING_COMMENT_MAX} ký tự`;
  if ([...f.betterPrompt].length > TEACHING_TEXT_MAX) return `Phiên bản tốt hơn tối đa ${TEACHING_TEXT_MAX} ký tự`;
  return '';
}

/**
 * The body for the server. A save from the dialog keeps the edits the mentor made on the review screen (`edited`), because the
 * server replaces the whole example.
 */
export function teachingBody(f: TeachingForm, edited: { editedPrompt: string | null; editedContext: string | null } = { editedPrompt: null, editedContext: null }): TeachingExampleBody {
  return {
    label: f.label as TeachingLabel,
    topic: f.topic,
    comment: f.comment.trim(),
    betterPrompt: f.betterPrompt.trim() === '' ? null : f.betterPrompt,
    editedPrompt: edited.editedPrompt,
    editedContext: edited.editedContext,
  };
}

/** One example on the review screen: what is stored, and the two texts the mentor may rewrite (starting from the stored edit, else the masked original). */
export interface ReviewItem {
  eventId: number;
  memberName: string;
  label: TeachingLabel;
  topic: TeachingTopic;
  /** What is stored now (comment, better version). */
  comment: string;
  betterPrompt: string | null;
  /** The mentor can fix these two on the review screen too (a name typed in a comment would reach the file). */
  commentDraft: string;
  betterDraft: string;
  defaultPrompt: string;
  defaultContext: string;
  /** What is stored on the server now (null = not edited). */
  savedPrompt: string | null;
  savedContext: string | null;
  promptDraft: string;
  contextDraft: string;
  /** The mentor marked it reviewed (kept on the server; any change of content clears it). */
  reviewed: boolean;
  /** The comment / better version when the screen opened: "Đã sửa" shows when the draft differs. */
  initialComment: string;
  initialBetter: string;
  /** Names the mentor said are not names in this example ("Không phải tên"): kept in this browser only. */
  dismissed: string[];
  /** A save of this example is running / failed. */
  saving: boolean;
  error: string;
}

export const reviewItemOf = (r: TeachingExampleRow): ReviewItem => ({
  eventId: r.eventId, memberName: r.memberName, label: r.label, topic: r.topic, comment: r.comment, betterPrompt: r.betterPrompt, commentDraft: r.comment, betterDraft: r.betterPrompt ?? '',
  defaultPrompt: r.defaultPrompt, defaultContext: r.defaultContext, savedPrompt: r.editedPrompt, savedContext: r.editedContext,
  promptDraft: r.editedPrompt ?? r.defaultPrompt, contextDraft: r.editedContext ?? r.defaultContext, reviewed: r.reviewed,
  initialComment: r.comment, initialBetter: r.betterPrompt ?? '', dismissed: [], saving: false, error: '',
});

/** A draft equal to the masked original is "not edited" (null): the file then follows the original. */
const editOf = (draft: string, original: string): string | null => (draft === original ? null : draft);

export const editedPromptOf = (i: ReviewItem) => editOf(i.promptDraft, i.defaultPrompt);
export const editedContextOf = (i: ReviewItem) => editOf(i.contextDraft, i.defaultContext);

/** The draft differs from what the server holds. */
const betterOf = (i: ReviewItem): string | null => (i.betterDraft.trim() === '' ? null : i.betterDraft);

export const isDirty = (i: ReviewItem): boolean =>
  editedPromptOf(i) !== i.savedPrompt || editedContextOf(i) !== i.savedContext || i.commentDraft.trim() !== i.comment || betterOf(i) !== i.betterPrompt;

/** Why the comment / better version of a draft cannot be saved (empty when it can). */
export function draftTextError(i: ReviewItem): string {
  if (i.commentDraft.trim() === '') return 'Nhận xét không được để trống';
  if ([...i.commentDraft.trim()].length > TEACHING_COMMENT_MAX) return `Nhận xét tối đa ${TEACHING_COMMENT_MAX} ký tự`;
  return '';
}

export const reviewBody = (i: ReviewItem): TeachingExampleBody => ({
  label: i.label, topic: i.topic, comment: i.commentDraft.trim(), betterPrompt: betterOf(i), editedPrompt: editedPromptOf(i), editedContext: editedContextOf(i),
});

/** The text of a draft is over the server's limit: said before the request, so the mentor can cut it. */
export const draftTooLong = (i: ReviewItem): boolean => [...i.promptDraft].length > TEACHING_TEXT_MAX || [...i.contextDraft].length > TEACHING_TEXT_MAX || [...i.betterDraft].length > TEACHING_TEXT_MAX;

/** `vi-du-buoi-1.md` */
export const teachingFileName = (trainingName: string): string => `vi-du-${slugOf(trainingName) || 'training'}.md`;

export { betterOf };

export type TextField = 'prompt' | 'context' | 'comment' | 'better';
export const FIELD_NAME: Record<TextField, string> = { prompt: 'prompt', context: 'bối cảnh', comment: 'nhận xét', better: 'phiên bản tốt hơn' };

const escapeRegExp = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The name as a pattern: the same letters and accents (typed composed or decomposed), any run of spaces between words, a whole word. */
function namePattern(name: string): RegExp | null {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if ([...words.join('')].length < 2) return null;
  const phrase = (form: 'NFC' | 'NFD') => words.map(w => escapeRegExp(w.normalize(form))).join('\\s+');
  const forms = [...new Set([phrase('NFC'), phrase('NFD')])];
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${forms.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
}

/**
 * Ranges `[start, end)` of `text` where `name` appears as a whole word (or phrase), ignoring case but not accents: "Lan" is in "lan ơi" and
 * "Lan đây", not in "lần", "plan" or "Lang". Short Vietnamese names are ordinary words once the accents are gone, so they are not matched that way.
 */
export function findName(text: string, name: string): [number, number][] {
  const re = namePattern(name);
  return re ? [...text.matchAll(re)].map(m => [m.index, m.index + m[0].length] as [number, number]) : [];
}

/** Every whole-word place of `name` in `text` replaced (same accents, any case); nothing else is touched. */
export function replaceName(text: string, name: string, replacement: string): string {
  let out = text;
  for (const [s, e] of findName(text, name).reverse()) out = out.slice(0, s) + replacement + out.slice(e);
  return out;
}

export const NAME_PLACEHOLDER = '[bạn]';

/**
 * Where the name of any member of the training appears in what would go in the file (the drafts, as they stand; whole words with the same accents, so "Lan" is not found in "lần"). Free text can hold a
 * name the file's metadata never had; the mentor is warned per field (PRODUCT.md §7.39g). Names shorter than 2 letters are skipped
 * (they would match everywhere); a name the mentor dismissed for this example is skipped too. A hint, not a guarantee.
 */
export function nameHits(item: Pick<ReviewItem, 'promptDraft' | 'contextDraft' | 'commentDraft' | 'betterDraft'> & { dismissed?: readonly string[] }, names: readonly string[]): { field: TextField; name: string }[] {
  const gone = new Set((item.dismissed ?? []).map(n => n.trim().toLowerCase()));
  const keys = [...new Set(names.map(n => n.trim()).filter(n => [...n].length >= 2 && !gone.has(n.toLowerCase())))];
  const fields: [TextField, string][] = [['prompt', item.promptDraft], ['context', item.contextDraft], ['comment', item.commentDraft], ['better', item.betterDraft]];
  const out: { field: TextField; name: string }[] = [];
  for (const [field, text] of fields) for (const name of keys) if (findName(text, name).length > 0) out.push({ field, name });
  return out;
}

/** The distinct names that look like a member's name in this example. */
export const suspectedNames = (hits: readonly { name: string }[]): string[] => [...new Set(hits.map(h => h.name))];

/** A piece of a draft for the highlight layer: a suspected name, a part the app masked, or plain text. */
export interface Segment { text: string; kind: 'plain' | 'name' | 'masked' }

const MASKED = /\[đã che\]|(?<![\w.])~(?=[\\/]|$|\s)/g;

/** Cuts a draft into pieces so the names can be drawn highlighted and the masked parts as grey chips. */
export function highlightSegments(text: string, names: readonly string[]): Segment[] {
  const marks: { s: number; e: number; kind: 'name' | 'masked' }[] = [];
  for (const n of names) for (const [s, e] of findName(text, n)) marks.push({ s, e, kind: 'name' });
  for (const m of text.matchAll(MASKED)) marks.push({ s: m.index, e: m.index + m[0].length, kind: 'masked' });
  marks.sort((a, b) => a.s - b.s || b.e - a.e);
  const out: Segment[] = [];
  let at = 0;
  for (const m of marks) {
    if (m.s < at) continue; // inside a piece already cut
    if (m.s > at) out.push({ text: text.slice(at, m.s), kind: 'plain' });
    out.push({ text: text.slice(m.s, m.e), kind: m.kind });
    at = m.e;
  }
  if (at < text.length) out.push({ text: text.slice(at), kind: 'plain' });
  return out;
}

/** How many fields the mentor changed from what the app gave: prompt and context against the masked original, comment and better version against the start of this screen. */
export const editedFieldCount = (i: ReviewItem): number =>
  Number(i.promptDraft !== i.defaultPrompt) + Number(i.contextDraft !== i.defaultContext) + Number(i.commentDraft !== i.initialComment) + Number(i.betterDraft !== i.initialBetter);

/** The line under an example in the list on the left. */
export function itemStatus(i: ReviewItem, hits: readonly { name: string }[]): { tone: 'warn' | 'ok' | 'plain'; text: string } {
  const edited = editedFieldCount(i);
  const editedText = edited > 0 ? ` · ${edited} trường đã sửa` : '';
  if (hits.length > 0) return { tone: 'warn', text: `${hits.length} chỗ nghi là tên · ${i.reviewed ? 'đã rà' : 'chưa rà'}` };
  return i.reviewed ? { tone: 'ok', text: `Đã rà${editedText}` } : { tone: 'plain', text: `Chưa rà${editedText}` };
}

/** The list order: by topic, then label (good first), then event id: the same grouping as the file, without its shuffle. */
export const sortReviewItems = (items: readonly ReviewItem[]): ReviewItem[] =>
  [...items].sort((a, b) => TEACHING_TOPICS.indexOf(a.topic) - TEACHING_TOPICS.indexOf(b.topic) || TEACHING_LABELS.indexOf(a.label) - TEACHING_LABELS.indexOf(b.label) || a.eventId - b.eventId);

export const reviewedCount = (items: readonly ReviewItem[]): number => items.filter(i => i.reviewed).length;

export const teachingCountText = (n: number): string => `${n} ví dụ`;
