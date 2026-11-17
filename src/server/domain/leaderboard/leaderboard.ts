import { rankLeaderboard, totalScore } from '../../../shared/scoring.js';
import type { SessionStatus } from '../../../shared/session-state.js';
import type { Attempt } from '../attempt/attempt.js';

export interface LeaderboardRow {
  rank: number;
  displayName: string;
  score: number;
  maxScore: number;
  submittedAt: number;
}

/**
 * docs/architecture.md §6: active participants with at least one submitted attempt, scored by their counted attempt.
 * PRODUCT §4.5: until the session is finalized only the automatic part counts; essay points the mentor has entered stay hidden.
 */
export function buildLeaderboard(f: {
  status: SessionStatus;
  totalPoints: number;
  counted: Map<number, Attempt>;
  names: Map<number, string>;
  /** PRODUCT.md §7.25: the mentor holds scores back. Only who has submitted (by time) goes out, no score or rank. */
  hidden?: boolean;
}): { provisional: boolean; hidden: boolean; entries: LeaderboardRow[]; submitted: { displayName: string; submittedAt: number }[] } {
  const provisional = f.status !== 'finalized';
  if (f.hidden) {
    const submitted = [...f.counted]
      .map(([pid, a]) => ({ displayName: f.names.get(pid) ?? '', submittedAt: a.submittedAt!.getTime() }))
      .sort((a, b) => a.submittedAt - b.submittedAt);
    return { provisional, hidden: true, entries: [], submitted };
  }
  const entries = [...f.counted].map(([pid, a]) => ({
    displayName: f.names.get(pid) ?? '',
    score: f.status === 'finalized' ? totalScore(a) : a.autoScore ?? 0,
    maxScore: f.totalPoints,
    submittedAt: a.submittedAt!.getTime(),
  }));
  return { provisional, hidden: false, entries: rankLeaderboard(entries), submitted: [] };
}
