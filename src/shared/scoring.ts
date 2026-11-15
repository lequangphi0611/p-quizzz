// Pure scoring rules — contract: docs/architecture.md §6, PRODUCT.md §4.4–4.5. No Node/DOM APIs.
import type { QuestionType } from './exam-format/index.js';

export interface ScorableQuestion {
  type: QuestionType;
  points: number;
  options: readonly { id: number; isCorrect: boolean }[];
}

/**
 * Multiple choice: the chosen set must equal the set of correct options exactly, else 0 (blank = 0).
 * Essay: `null` — a mentor grades it by hand.
 */
export function scoreAnswer(q: ScorableQuestion, selectedOptionIds: readonly number[] | null | undefined): number | null {
  if (q.type === 'essay') return null;
  const chosen = new Set(selectedOptionIds ?? []);
  const correct = q.options.filter(o => o.isCorrect).map(o => o.id);
  const exact = correct.length > 0 && chosen.size === correct.length && correct.every(id => chosen.has(id));
  return exact ? q.points : 0;
}

/** Automatic part plus the mentor's manual part (a missing part counts as 0). */
export const totalScore = (s: { autoScore: number | null; manualScore: number | null }): number => (s.autoScore ?? 0) + (s.manualScore ?? 0);

export interface CountableAttempt {
  id: number;
  submittedAt: number | null; // epoch ms; null = still in progress
  score: number; // totalScore()
}

/**
 * The attempt that counts for ranking. Only submitted attempts qualify.
 * Exam with essays → its single attempt. Multiple-choice only → highest score; a tie goes to the earlier submission.
 */
export function pickCountedAttempt<T extends CountableAttempt>(attempts: readonly T[], hasEssay: boolean): T | null {
  const submitted = attempts
    .filter(a => a.submittedAt !== null)
    .sort((a, b) => a.submittedAt! - b.submittedAt! || a.id - b.id);
  if (submitted.length === 0) return null;
  if (hasEssay) return submitted[0]!;
  return submitted.reduce((best, a) => (a.score > best.score ? a : best));
}

export interface RankableEntry {
  displayName: string;
  score: number;
  submittedAt: number; // epoch ms of the counted attempt
}

/**
 * Leaderboard order: higher score first; equal score → earlier submission first (PRODUCT.md §7.1).
 * Entries with the same score AND the same submission time share a rank, and the next rank skips
 * ahead as in sports tables (1, 1, 3).
 */
export function rankLeaderboard<T extends RankableEntry>(rows: readonly T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort(
    (a, b) => b.score - a.score || a.submittedAt - b.submittedAt || a.displayName.localeCompare(b.displayName, 'vi'),
  );
  const out: (T & { rank: number })[] = [];
  sorted.forEach((row, i) => {
    const prev = out[i - 1];
    const tied = prev !== undefined && prev.score === row.score && prev.submittedAt === row.submittedAt;
    out.push({ ...row, rank: tied ? prev.rank : i + 1 });
  });
  return out;
}
