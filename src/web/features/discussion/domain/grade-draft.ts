import type { DiscussionAnswer } from '../../../../shared/api/index.js';
import { formatPoints } from '../../../shared/format/points.js';
import { parseScore } from '../../../shared/grading/score.js';

export type SaveState = 'saved' | 'saving' | 'error' | 'unsaved';
/** What the mentor has typed for one paper, plus where it stands. */
export interface Draft { value: string; feedback: string; save: SaveState; error?: string }

export const draftOf = (a: Pick<DiscussionAnswer, 'manualScore' | 'feedback'>): Draft => ({ value: a.manualScore === null ? '' : formatPoints(a.manualScore), feedback: a.feedback ?? '', save: a.manualScore === null ? 'unsaved' : 'saved' });

/** What to do with the typed score and feedback of a paper. */
export type SavePlan =
  | { kind: 'incomplete' } // no score typed yet: keep the draft, nothing to send
  | { kind: 'invalid'; message: string }
  | { kind: 'unchanged'; score: number } // the server already has exactly this
  | { kind: 'send'; score: number };

export function planSave(a: Pick<DiscussionAnswer, 'manualScore' | 'feedback'>, points: number, value: string, feedback: string): SavePlan {
  if (value.trim() === '') return { kind: 'incomplete' };
  const check = parseScore(value, points);
  if (!check.ok) return { kind: 'invalid', message: check.message };
  if (check.value === a.manualScore && (feedback.trim() || null) === (a.feedback ?? null)) return { kind: 'unchanged', score: check.value };
  return { kind: 'send', score: check.value };
}
