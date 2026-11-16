// Pure helpers still shared by the member join and review pages (moved into their features in P5-3).
// The exam-taking helpers live in features/member-exam/domain; shared UI bits in shared/ui/member.
import type { ReviewQuestion } from '../../shared/api/index.js';
import { formatPoints } from '../shared/format/points.js';
import type { ReviewMark, ReviewMarkKind } from '../shared/ui/member/review-mark.js';

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
