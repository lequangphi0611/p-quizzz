// How a reviewed question went (full / none / some points / essay waiting), and which ones to show with "Chỉ câu chưa đúng".
import type { ReviewQuestion } from '../../../../shared/api/index.js';
import { formatPoints } from '../../../shared/format/points.js';
import type { ReviewMark, ReviewMarkKind } from '../../../shared/ui/member/review-mark.js';

/** How one reviewed question went: full / no / some points, or an essay still waiting for the mentor. */
export function reviewMark(q: Pick<ReviewQuestion, 'type' | 'points' | 'score'>): ReviewMark {
  if (q.score === null) return { kind: q.type === 'essay' ? 'pending' : 'wrong', text: q.type === 'essay' ? 'Chờ chấm' : `0/${formatPoints(q.points)}` };
  const kind: ReviewMarkKind = q.score >= q.points ? 'correct' : q.score > 0 ? 'partial' : 'wrong';
  return { kind, text: `${formatPoints(q.score)}/${formatPoints(q.points)}` };
}

/** Indexes shown with "Chỉ câu chưa đúng": everything that is not full marks (pending essays included). */
export const notCorrectIndexes = (marks: readonly ReviewMark[]): number[] => marks.flatMap((m, i) => (m.kind === 'correct' ? [] : [i]));
