import { isValidEmail, normalizeEmail } from '../../../shared/email-list.js';
import { EmptyEmailListError, InvalidEmailsError } from './errors.js';

/**
 * The emails a mentor submits (already parsed by the preview, or raw): normalized, de-duplicated, first occurrence
 * wins. Anything that is not an email is refused rather than silently dropped, so a typo cannot lock a member out unseen.
 */
export function cleanEmails(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const bad: string[] = [];
  for (const r of raw) {
    const email = normalizeEmail(r);
    if (!email) continue;
    if (!isValidEmail(email)) { bad.push(r.trim()); continue; }
    seen.add(email);
  }
  if (bad.length > 0) throw new InvalidEmailsError(bad);
  if (seen.size === 0) throw new EmptyEmailListError();
  return [...seen];
}
