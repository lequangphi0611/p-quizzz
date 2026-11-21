/**
 * Strings that look like a key, a token or a password (PRODUCT.md §7.35c "có thể lộ bí mật"). A hint, not a guarantee:
 * it errs towards the common shapes. The same patterns will mask text in the exported report (S40).
 */
export const SECRET_PATTERNS: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /\b(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key)\b["']?\s*[:=]\s*["']?[^\s"',;]{8,}/i,
];

export const looksLikeSecret = (text: string): boolean => SECRET_PATTERNS.some(p => p.test(text));
