// Pure helpers for the member screens (S18). No DOM access beyond plain data.
import type { ReviewQuestion } from '../../shared/api/index.js';
import { formatPoints } from './exam-progress.js';

/** Desktop layout from this width up (below: phone/tablet layout). */
export const DESK_MIN = 1024;
/** Wide desktop: full sidebar and margins from this width up. */
export const WIDE_MIN = 1280;

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
 * Exam-taking shortcuts (PRODUCT.md §7.18): ← → move, 1–9 pick, ? help, Esc leaves a field / closes.
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

export type ReviewMarkKind = 'correct' | 'wrong' | 'partial' | 'pending';
export interface ReviewMark { kind: ReviewMarkKind; text: string }

/** How one reviewed question went: full / no / some points, or an essay still waiting for the mentor. */
export function reviewMark(q: Pick<ReviewQuestion, 'type' | 'points' | 'score'>): ReviewMark {
  if (q.score === null) return { kind: q.type === 'essay' ? 'pending' : 'wrong', text: q.type === 'essay' ? 'Chờ chấm' : `0/${formatPoints(q.points)}` };
  const kind: ReviewMarkKind = q.score >= q.points ? 'correct' : q.score > 0 ? 'partial' : 'wrong';
  return { kind, text: `${formatPoints(q.score)}/${formatPoints(q.points)}` };
}

/** Indexes shown with "Chỉ câu chưa đúng": everything that is not full marks (pending essays included). */
export const notCorrectIndexes = (marks: readonly ReviewMark[]): number[] => marks.flatMap((m, i) => (m.kind === 'correct' ? [] : [i]));

/** Seconds to wait from the join limiter's 429 message ("… Thử lại sau 42 giây"); 0 when not found. */
export function retrySecondsFrom(message: string): number {
  const m = /(\d+)\s*giây/.exec(message);
  return m ? Number(m[1]) : 0;
}

/** "Câu 2, Câu 4" for the submit dialog (1-based). */
export const questionList = (indexes: readonly number[]): string => indexes.map(i => `Câu ${i + 1}`).join(', ');

/** One-line plain text of a Markdown prompt for the sidebar (no backticks / emphasis markers). */
export const plainPrompt = (s: string): string => s.replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
