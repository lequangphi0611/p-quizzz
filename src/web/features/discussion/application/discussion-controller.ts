import type { DiscussionAnswer, DiscussionQuestion, DiscussionView, GradeResponse } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { formatPoints } from '../../../shared/format/points.js';
import { nextUngraded } from '../domain/discussion-ui.js';
import { draftOf, planSave, type Draft } from '../domain/grade-draft.js';
import type { DiscussionGateway } from './discussion-gateway.js';

export interface DiscussionState {
  view: DiscussionView | null;
  load: 'loading' | 'ready' | 'error';
  /** Server message when loading failed with a real response (not a network failure). */
  loadError: string | undefined;
  /** Question ids whose answer the mentor has revealed (session-local, never sent anywhere). */
  revealed: ReadonlySet<number>;
  /** Question ids whose class work (tallies, essay papers) the mentor has shown (S25). Same lifetime as `revealed`. */
  work: ReadonlySet<number>;
  mode: 'list' | 'paper';
  paperIdx: number;
  lastOpened: number | null;
  drafts: Record<number, Draft>;
  dialog: boolean;
  finalizing: boolean;
  finalizeError: string | undefined;
  zeroing: boolean;
}

export const initialDiscussionState = (): DiscussionState => ({
  view: null, load: 'loading', loadError: undefined, revealed: new Set(), work: new Set(), mode: 'list', paperIdx: 0, lastOpened: null, drafts: {},
  dialog: false, finalizing: false, finalizeError: undefined, zeroing: false,
});

/**
 * State and actions of the projector discussion screen (S17). Plain TypeScript, tested with a fake gateway.
 * The question on screen comes from the URL (`?q=`), so the UI passes the current question where an action needs it.
 */
export class DiscussionController {
  private state = initialDiscussionState();
  private listeners = new Set<() => void>();

  constructor(private gateway: DiscussionGateway, private sessionId: number) {}

  getState = (): DiscussionState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(patch: Partial<DiscussionState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) l();
  }

  get locked(): boolean { return this.state.view?.status === 'finalized'; }

  async load(): Promise<void> {
    this.set({ load: 'loading' });
    try { this.set({ view: await this.gateway.getView(this.sessionId), load: 'ready' }); }
    catch (err) { this.set({ loadError: err instanceof ApiError && err.status !== 0 ? err.message : undefined, load: 'error' }); }
  }

  // ── navigation ──
  /** A different question is on screen: back to its list, forget which paper was open. */
  questionChanged(): void { this.set({ mode: 'list', lastOpened: null }); }
  toggleReveal(questionId: number): void {
    const r = new Set(this.state.revealed);
    if (!r.delete(questionId)) r.add(questionId);
    this.set({ revealed: r });
  }
  /** B: show or hide the class's work. Hiding it while a paper is open goes back to the (now hidden) list. */
  toggleWork(questionId: number): void {
    const w = new Set(this.state.work);
    const hide = w.delete(questionId);
    if (!hide) w.add(questionId);
    this.set(hide ? { work: w, mode: 'list' } : { work: w });
  }
  openPaper(index: number): void { this.set({ mode: 'paper', paperIdx: index, lastOpened: index }); }
  backToList(): void { this.set({ mode: 'list' }); }
  /** J / K: from the list jump to the first ungraded (J) or last paper (K); in a paper step by one, clamped. */
  stepPaper(papers: readonly DiscussionAnswer[], dir: 1 | -1): void {
    if (papers.length === 0) return;
    if (this.state.mode === 'list') this.openPaper(dir === 1 ? (nextUngraded(papers, -1) ?? 0) : papers.length - 1);
    else this.openPaper(Math.max(0, Math.min(papers.length - 1, this.state.paperIdx + dir)));
  }

  // ── grading ──
  draftFor(a: DiscussionAnswer): Draft { return this.state.drafts[a.answerId] ?? draftOf(a); }
  private patchDraft(answerId: number, base: Draft, patch: Partial<Draft>): void {
    this.set({ drafts: { ...this.state.drafts, [answerId]: { ...(this.state.drafts[answerId] ?? base), ...patch } } });
  }
  editScore(a: DiscussionAnswer, value: string): void { this.patchDraft(a.answerId, this.draftFor(a), { value, error: undefined, save: 'unsaved' }); }
  editFeedback(a: DiscussionAnswer, feedback: string): void { this.patchDraft(a.answerId, this.draftFor(a), { feedback, save: 'unsaved' }); }

  /** The server's answer is the truth: adopt the saved grade and the progress it reports. */
  private applyGrade(r: GradeResponse): void {
    const v = this.state.view;
    if (!v) return;
    this.set({
      view: {
        ...v, graded: r.graded, total: r.total,
        questions: v.questions.map(x => ({ ...x, answers: x.answers.map(a => (a.answerId === r.answer.answerId ? { ...a, manualScore: r.answer.manualScore, feedback: r.answer.feedback } : a)) })),
      },
    });
  }

  /** Save one paper. True when the server has this score (already or now). */
  private async save(a: DiscussionAnswer, points: number, value: string, feedback: string): Promise<boolean> {
    const base = this.draftFor(a);
    const plan = planSave(a, points, value, feedback);
    if (plan.kind === 'incomplete') { this.patchDraft(a.answerId, base, { value, feedback, error: undefined, save: a.manualScore === null ? 'unsaved' : base.save }); return false; }
    if (plan.kind === 'invalid') { this.patchDraft(a.answerId, base, { value, feedback, error: plan.message, save: 'unsaved' }); return false; }
    if (plan.kind === 'unchanged') { this.patchDraft(a.answerId, base, { value: formatPoints(plan.score), feedback, error: undefined, save: 'saved' }); return true; }
    this.patchDraft(a.answerId, base, { value, feedback, error: undefined, save: 'saving' });
    try {
      this.applyGrade(await this.gateway.gradeAnswer(a.answerId, { score: plan.score, feedback }));
      this.patchDraft(a.answerId, base, { value: formatPoints(plan.score), save: 'saved' });
      return true;
    } catch (err) {
      this.patchDraft(a.answerId, base, { save: 'error', error: err instanceof ApiError ? err.message : 'Không lưu được' });
      return false;
    }
  }

  /** Score field committed (blur / Enter). With `enter`, move on to the next ungraded paper after a successful save. */
  async commitScore(q: Pick<DiscussionQuestion, 'points'>, papers: readonly DiscussionAnswer[], value: string, enter: boolean): Promise<void> {
    const { paperIdx } = this.state;
    const a = papers[paperIdx];
    if (!a || this.locked) return;
    const ok = await this.save(a, q.points, value, this.draftFor(a).feedback);
    if (ok && enter) {
      const n = nextUngraded(papers.map((p, i) => (i === paperIdx ? { manualScore: 0 } : p)), paperIdx);
      if (n !== null) this.openPaper(n);
    }
  }

  async commitFeedback(q: Pick<DiscussionQuestion, 'points'>, papers: readonly DiscussionAnswer[]): Promise<void> {
    const a = papers[this.state.paperIdx];
    if (!a || this.locked) return;
    const d = this.draftFor(a);
    if (d.value.trim() === '') { if ((d.feedback.trim() || null) !== (a.feedback ?? null)) this.patchDraft(a.answerId, d, { save: 'unsaved' }); return; } // needs a score first
    await this.save(a, q.points, d.value, d.feedback);
  }

  async zeroBlanks(blanks: readonly DiscussionAnswer[]): Promise<void> {
    this.set({ zeroing: true });
    try {
      for (const b of blanks.filter(x => x.manualScore === null)) this.applyGrade(await this.gateway.gradeAnswer(b.answerId, { score: 0 }));
    } catch { void this.load(); } finally { this.set({ zeroing: false }); }
  }

  // ── finalize ──
  openFinalize(): void { this.set({ finalizeError: undefined, dialog: true }); }
  closeFinalize(): void { this.set({ dialog: false }); }
  async finalize(): Promise<void> {
    this.set({ finalizing: true, finalizeError: undefined });
    try {
      await this.gateway.finalize(this.sessionId);
      const v = this.state.view;
      this.set({ dialog: false, view: v && { ...v, status: 'finalized' } });
    } catch (err) {
      this.set({ finalizeError: err instanceof ApiError ? err.message : 'Không chốt được' });
    } finally { this.set({ finalizing: false }); }
  }
}
