import type { GradingAnswer } from '../../../../shared/api/index.js';
import { formatPoints } from '../../../shared/format/points.js';
import { parseScore } from '../../../shared/grading/score.js';

/** What to do when the mentor leaves an answer card (blur / Enter). */
export type CardSavePlan =
  | { kind: 'nothing' }
  | { kind: 'invalid'; message: string }
  /** A saved grade cannot be withdrawn: put the saved score back instead of leaving the field blank while the server keeps it. */
  | { kind: 'restore'; score: string; message: string }
  | { kind: 'send'; score: number };

export function planCardSave(answer: Pick<GradingAnswer, 'manualScore' | 'feedback'>, score: string, feedback: string, points: number): CardSavePlan {
  const check = parseScore(score, points);
  const dirty = (answer.manualScore === null ? score.trim() !== '' : !(check.ok && check.value === answer.manualScore)) || feedback.trim() !== (answer.feedback ?? '');
  if (!dirty) return { kind: 'nothing' };
  if (!check.ok) {
    if (score.trim() !== '') return { kind: 'invalid', message: check.message };
    if (answer.manualScore !== null) return { kind: 'restore', score: formatPoints(answer.manualScore), message: 'Không bỏ trống được điểm đã chấm. Nhập điểm mới (có thể là 0).' };
    return { kind: 'nothing' }; // feedback alone waits for a score
  }
  return { kind: 'send', score: check.value };
}
