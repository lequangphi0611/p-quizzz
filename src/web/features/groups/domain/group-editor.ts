import { parseEmailList, type EmailListParse } from '../../../../shared/email-list.js';
import { MAX_GROUP_EMAILS, MAX_GROUP_NAME_LENGTH } from '../../../../shared/api/index.js';

export interface EditorDraft {
  name: string;
  /** Input convenience only: lines typed without "@" get it. What is saved is always the full email. */
  defaultDomain: string;
  text: string;
}

export const EMPTY_DRAFT: EditorDraft = { name: '', defaultDomain: '', text: '' };

/** A saved group opened for editing: one email per line, so editing one is editing a line. */
export const draftOfGroup = (g: { name: string; emails: readonly string[] }): EditorDraft => ({ name: g.name, defaultDomain: '', text: g.emails.join('\n') });

export const parseDraft = (d: EditorDraft): EmailListParse => parseEmailList(d.text, d.defaultDomain);

/** What stops saving, in the mentor's words ('' = can save). Bad lines do NOT stop it: they are left out and the preview says so. */
export function saveBlocker(d: EditorDraft, parse: EmailListParse): string {
  if (!d.name.trim()) return 'Nhập tên nhóm';
  if ([...d.name.trim()].length > MAX_GROUP_NAME_LENGTH) return `Tên nhóm tối đa ${MAX_GROUP_NAME_LENGTH} ký tự`;
  if (parse.valid.length === 0) return 'Cần ít nhất một email hợp lệ';
  if (parse.valid.length > MAX_GROUP_EMAILS) return `Một nhóm tối đa ${MAX_GROUP_EMAILS} email`;
  return '';
}

/** The emails to send: the clean first occurrences, in the order typed. */
export const emailsToSave = (parse: EmailListParse): string[] => parse.valid.map(v => v.email);

/** Has anything been typed that would be lost by leaving? */
export const isDirty = (draft: EditorDraft, saved: EditorDraft): boolean => draft.name !== saved.name || draft.text !== saved.text || draft.defaultDomain !== saved.defaultDomain;
