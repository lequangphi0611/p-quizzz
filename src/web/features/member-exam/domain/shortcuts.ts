// Exam-taking keyboard shortcuts (PRODUCT.md §7.18). Pure: no DOM access beyond plain data.

export type ShortcutAction = { kind: 'prev' } | { kind: 'next' } | { kind: 'help' } | { kind: 'pick'; index: number } | { kind: 'blur' } | { kind: 'close' };

export interface KeyInput {
  key: string;
  altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean;
  /** Focus is in an input, textarea, select or contenteditable. */
  inField: boolean;
  /** A dialog, sheet or the help panel is open. */
  overlay: boolean;
}

/**
 * ← → move, 1–9 pick, ? help, Esc leaves a field / closes.
 * Off while typing in a field, while an overlay is open, and with Ctrl/Alt/⌘ (keeps browser shortcuts such as Alt+←).
 * Submitting has no shortcut on purpose.
 */
export function shortcutFor(e: KeyInput): ShortcutAction | null {
  if (e.key === 'Escape') return e.overlay ? { kind: 'close' } : e.inField ? { kind: 'blur' } : null;
  if (e.inField || e.overlay || e.altKey || e.ctrlKey || e.metaKey) return null;
  if (e.key === 'ArrowLeft') return { kind: 'prev' };
  if (e.key === 'ArrowRight') return { kind: 'next' };
  if (e.key === '?') return { kind: 'help' };
  if (/^[1-9]$/.test(e.key)) return { kind: 'pick', index: Number(e.key) - 1 };
  return null;
}

/** "Câu 2, Câu 4" for the submit dialog (1-based). */
export const questionList = (indexes: readonly number[]): string => indexes.map(i => `Câu ${i + 1}`).join(', ');
