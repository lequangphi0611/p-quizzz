// Pure helpers for the lists of member emails a mentor types or pastes (PRODUCT.md §7.22). Shared by the server (which
// parses again before saving) and the web (live preview). No Node or DOM APIs.

/** Trim and lower-case: emails are compared case-insensitively. Accents are NOT folded (PRODUCT.md §7.22b). */
export const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

const MAX_EMAIL_LENGTH = 254;
const LOCAL = /[^\s@<>()[\]\\,;:"]+/.source;
const LABEL = /[^\s@<>()[\]\\,;:".]+/.source;
const EMAIL_SHAPE = new RegExp(`^${LOCAL}@${LABEL}(?:\\.${LABEL})+$`);

/** Basic shape only: one `@`, something before it, a dotted domain after it, no spaces. We never send mail, so no more is needed. */
export const isValidEmail = (email: string): boolean => email.length <= MAX_EMAIL_LENGTH && EMAIL_SHAPE.test(email);

/** "@Company.vn " → "company.vn": the optional default domain for lines typed without one. */
export const normalizeDomain = (raw: string | undefined): string => (raw ?? '').trim().replace(/^@+/, '').toLowerCase();

export interface ParsedEmail {
  email: string; // normalized
  line: number; // 1-based line in the pasted text
  raw: string; // what was typed
  addedDomain: boolean; // the default domain was appended
}

export interface DuplicateEmail {
  email: string;
  line: number;
  raw: string;
  firstLine: number;
}

export interface InvalidEmailLine {
  line: number;
  raw: string;
  reason: 'missing_at' | 'format';
  message: string;
}

export interface EmailListParse {
  /** First occurrence of each valid email, in the order typed. */
  valid: ParsedEmail[];
  /** Later repeats of an email already in `valid` (case-insensitive): merged into one. */
  duplicates: DuplicateEmail[];
  invalid: InvalidEmailLine[];
}

const TOKEN_SEPARATORS = /[,;\s]+/;
const stripWrapping = (t: string) => t.replace(/^[<"'(]+|[>"')]+$/g, '');

/**
 * Splits pasted text into emails: one per line, or several separated by commas/semicolons/spaces. A token without `@`
 * gets `@defaultDomain` when one is given (an input convenience only: what is stored is always the full email).
 */
export function parseEmailList(text: string, defaultDomain?: string): EmailListParse {
  const domain = normalizeDomain(defaultDomain);
  const valid: ParsedEmail[] = [];
  const duplicates: DuplicateEmail[] = [];
  const invalid: InvalidEmailLine[] = [];
  const firstSeen = new Map<string, number>();

  text.split(/\r\n|\r|\n/).forEach((lineText, index) => {
    const line = index + 1;
    const tokens = lineText.split(TOKEN_SEPARATORS).map(stripWrapping).filter(Boolean);
    // "Nguyễn Văn A <a@x.vn>": a name next to an email. The default domain is for lines that hold no email at all, so the
    // pieces of the name are refused instead of being turned into emails nobody meant to add.
    const mixedLine = tokens.some(t => t.includes('@'));
    for (const raw of tokens) {
      const hasAt = raw.includes('@');
      if (!hasAt && mixedLine) { invalid.push({ line, raw, reason: 'missing_at', message: 'Dòng này đã có email, phần chữ còn lại không phải email — để mỗi email một dòng' }); continue; }
      if (!hasAt && !domain) { invalid.push({ line, raw, reason: 'missing_at', message: 'Thiếu @ — gõ đủ email hoặc điền domain mặc định' }); continue; }
      const email = normalizeEmail(hasAt ? raw : `${raw}@${domain}`);
      if (!isValidEmail(email)) { invalid.push({ line, raw, reason: 'format', message: 'Email chưa đúng định dạng' }); continue; }
      const first = firstSeen.get(email);
      if (first !== undefined) { duplicates.push({ email, line, raw, firstLine: first }); continue; }
      firstSeen.set(email, line);
      valid.push({ email, line, raw, addedDomain: !hasAt });
    }
  });
  return { valid, duplicates, invalid };
}
