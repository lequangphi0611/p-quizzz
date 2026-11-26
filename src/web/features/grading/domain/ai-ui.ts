import type { GradingAnswer, GradingQuestion, GradingView } from '../../../../shared/api/index.js';
import { isBlank } from './grading-ui.js';

// Pure rules of the AI suggestion UI (PRODUCT.md §7.28, design "AI chấm nháp"). A suggestion is never a grade:
// every count of "graded" here is the mentor's own.

export interface AiCounts {
  total: number;
  graded: number;
  blank: number;
  blankUngraded: number;
  /** Written answers that went to the AI (any state). */
  sent: number;
  ok: number;
  err: number;
  /** Waiting or running. */
  queued: number;
  running: boolean;
  /** Suggestions the mentor has not confirmed yet. */
  sugPending: number;
  flagPending: number;
  errPending: number;
  /** Written, ungraded, never sent: what "AI chấm nháp" would send. */
  toSend: number;
}

const graded = (a: GradingAnswer) => a.manualScore !== null;
export const hasSuggestion = (a: GradingAnswer) => a.aiSuggestion?.status === 'done';
export const isFlagged = (a: GradingAnswer) => hasSuggestion(a) && !!a.aiSuggestion!.suspicious;
/** A finished suggestion still waiting for the mentor. */
export const awaitsConfirmation = (a: GradingAnswer) => hasSuggestion(a) && !graded(a);
export const isFlagPending = (a: GradingAnswer) => isFlagged(a) && !graded(a);
export const isErrPending = (a: GradingAnswer) => a.aiSuggestion?.status === 'failed' && !graded(a);
export const isWaiting = (a: GradingAnswer) => a.aiSuggestion?.status === 'queued' || a.aiSuggestion?.status === 'running';

export function aiCounts(q: Pick<GradingQuestion, 'answers'>): AiCounts {
  const c: AiCounts = { total: q.answers.length, graded: 0, blank: 0, blankUngraded: 0, sent: 0, ok: 0, err: 0, queued: 0, running: false, sugPending: 0, flagPending: 0, errPending: 0, toSend: 0 };
  for (const a of q.answers) {
    if (graded(a)) c.graded++;
    if (isBlank(a)) {
      c.blank++;
      if (!graded(a)) c.blankUngraded++;
      continue;
    }
    const s = a.aiSuggestion;
    if (s) c.sent++;
    if (s?.status === 'done') c.ok++;
    if (s?.status === 'failed') c.err++;
    if (isWaiting(a)) {
      c.queued++;
      c.running = true;
    }
    if (awaitsConfirmation(a)) c.sugPending++;
    if (isFlagPending(a)) c.flagPending++;
    if (isErrPending(a)) c.errPending++;
    if (!s && !graded(a)) c.toSend++;
  }
  return c;
}

export type StripMode = 'off' | 'final' | 'norubric' | 'running' | 'done' | 'allgraded' | 'ready';

/** Which state the AI strip under the question shows. */
export function stripMode(view: Pick<GradingView, 'status' | 'aiGrader'>, q: Pick<GradingQuestion, 'hasRubric'>, c: AiCounts): StripMode {
  if (!view.aiGrader.available) return 'off';
  if (view.status === 'finalized') return 'final';
  if (!q.hasRubric) return 'norubric';
  if (c.running) return 'running';
  if (c.sent > 0 && (c.sugPending > 0 || c.errPending > 0)) return 'done';
  if (c.toSend === 0) return 'allgraded';
  return c.sent > 0 ? 'done' : 'ready';
}

export type AnswerFilter = 'all' | 'todo' | 'flag' | 'err';

export const matchesFilter = (a: GradingAnswer, f: AnswerFilter): boolean =>
  f === 'all' ? true : f === 'todo' ? awaitsConfirmation(a) : f === 'flag' ? isFlagPending(a) : isErrPending(a);

/**
 * The cards to show, each with its "Bài #k" number from the shuffled order (stable, unrelated to filters). Ungraded
 * suspicious answers are pinned first; everything else keeps the shuffled order.
 */
export function visibleAnswers(answers: GradingAnswer[], f: AnswerFilter, kept: ReadonlySet<number> = new Set()): { answer: GradingAnswer; index: number; pinned: boolean }[] {
  // `kept`: answers graded in this view stay in place (so "Hoàn tác" is still reachable) until the question or the filter changes.
  // A suspicious one graded here keeps its place at the top, without the pin.
  const rows = answers
    .map((answer, index) => ({ answer, index, pinned: isFlagPending(answer), top: isFlagPending(answer) || (kept.has(answer.answerId) && isFlagged(answer)) }))
    .filter(r => kept.has(r.answer.answerId) || matchesFilter(r.answer, f));
  return [...rows.filter(r => r.top), ...rows.filter(r => !r.top)].map(({ answer, index, pinned }) => ({ answer, index, pinned }));
}

/** Whether the page should keep refreshing: some suggestion is still waiting or running. */
export const needsPolling = (view: Pick<GradingView, 'questions'>): boolean => view.questions.some(q => q.answers.some(isWaiting));

/** What still blocks "Chốt kết quả": ungraded answers, and how many of them only have an unconfirmed AI suggestion. */
export function finalizeBlockers(view: Pick<GradingView, 'questions'>): { left: number; suggestedOnly: number } {
  const all = view.questions.flatMap(q => q.answers);
  return { left: all.filter(a => !graded(a)).length, suggestedOnly: all.filter(awaitsConfirmation).length };
}

/** 1-based line numbers of the answer that the AI flagged (for highlighting). */
export const flaggedLines = (a: GradingAnswer): Set<number> => new Set(isFlagged(a) ? a.aiSuggestion!.suspiciousLines : []);

/** Long answers start collapsed (never a suspicious one: the mentor must read it whole). */
export const startsCollapsed = (a: GradingAnswer): boolean => !isFlagged(a) && !!a.textAnswer && (a.textAnswer.length > 420 || a.textAnswer.split('\n').length > 7);

/** Tone of one criterion score: full, partial, none. */
export const criterionTone = (score: number, max: number): 'full' | 'partial' | 'none' => (score >= max ? 'full' : score > 0 ? 'partial' : 'none');

/** How the mentor's grade relates to the suggestion it came from. */
export function gradeSource(a: GradingAnswer): 'ai' | 'ai-edit' | null {
  if (!graded(a) || !a.aiSuggestion) return null;
  return a.aiSuggestion.used === 'accepted' ? 'ai' : a.aiSuggestion.used === 'edited' ? 'ai-edit' : null;
}

/** Ids of the written, ungraded answers of this question never sent to the AI (what "AI chấm nháp" announces). */
export const unsentIds = (q: Pick<GradingQuestion, 'answers'>): number[] => q.answers.filter(a => !isBlank(a) && !a.aiSuggestion && !graded(a)).map(a => a.answerId);

/** Ids of the answers of this question whose suggestion failed and are still ungraded ("Thử lại các bài lỗi"). */
export const failedIds = (q: Pick<GradingQuestion, 'answers'>): number[] => q.answers.filter(isErrPending).map(a => a.answerId);
