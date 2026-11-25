import {
  TEACHING_COMMENT_MAX, TEACHING_TEXT_MAX, type TeachingExampleBody, type TeachingExampleRow, type TeachingLabel, type TeachingTopic, type TrainingMemberRow,
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
  /** A save of this example is running / failed. */
  saving: boolean;
  error: string;
}

export const reviewItemOf = (r: TeachingExampleRow): ReviewItem => ({
  eventId: r.eventId, memberName: r.memberName, label: r.label, topic: r.topic, comment: r.comment, betterPrompt: r.betterPrompt, commentDraft: r.comment, betterDraft: r.betterPrompt ?? '',
  defaultPrompt: r.defaultPrompt, defaultContext: r.defaultContext, savedPrompt: r.editedPrompt, savedContext: r.editedContext,
  promptDraft: r.editedPrompt ?? r.defaultPrompt, contextDraft: r.editedContext ?? r.defaultContext, saving: false, error: '',
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

/** `vi-du-day-buoi-1.md` */
export const teachingFileName = (trainingName: string): string => `vi-du-day-${slugOf(trainingName) || 'training'}.md`;

export { betterOf };

/** Lower case without accents (đ → d), so "Thanh Tùng" is found in "thanh tung". */
const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

export type TextField = 'prompt' | 'context' | 'comment' | 'better';
export const FIELD_NAME: Record<TextField, string> = { prompt: 'prompt', context: 'bối cảnh', comment: 'nhận xét', better: 'phiên bản tốt hơn' };

/**
 * Where the name of any member of the training appears in what would go in the file (the drafts, as they stand). Free text can hold a
 * name the file's metadata never had; the mentor is warned per field (PRODUCT.md §7.39g). Names shorter than 2 letters are skipped
 * (they would match everywhere). A hint, not a guarantee.
 */
export function nameHits(item: Pick<ReviewItem, 'promptDraft' | 'contextDraft' | 'commentDraft' | 'betterDraft'>, names: readonly string[]): { field: TextField; name: string }[] {
  const keys = [...new Set(names.map(n => n.trim()).filter(n => [...fold(n)].length >= 2))];
  const fields: [TextField, string][] = [['prompt', item.promptDraft], ['context', item.contextDraft], ['comment', item.commentDraft], ['better', item.betterDraft]];
  const out: { field: TextField; name: string }[] = [];
  for (const [field, text] of fields) {
    const hay = fold(text);
    for (const name of keys) if (hay.includes(fold(name))) out.push({ field, name });
  }
  return out;
}

export const teachingCountText = (n: number): string => `${n} ví dụ`;
