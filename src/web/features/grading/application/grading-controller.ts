import type { GradeResponse, GradingAnswer, GradingQuestion, GradingView } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { isBlank } from '../domain/grading-ui.js';
import type { GradingGateway } from './grading-gateway.js';

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

export interface GradingState {
  view: GradingView;
  /** Index of the essay question on screen. */
  cur: number;
  /** Names stay hidden until the mentor chooses to show them: grading should not depend on who wrote the answer. */
  blind: boolean;
  error: string;
  zeroing: boolean;
  confirming: boolean;
  finalizing: boolean;
}

/** State and actions of the essay-grading page. Plain TypeScript, tested with a fake gateway. */
export class GradingController {
  private state: GradingState;
  private listeners = new Set<() => void>();

  constructor(private gateway: GradingGateway, private sessionId: number, initial: GradingView) {
    this.state = { view: initial, cur: 0, blind: true, error: '', zeroing: false, confirming: false, finalizing: false };
  }

  getState = (): GradingState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(patch: Partial<GradingState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) l();
  }

  get question(): GradingQuestion | undefined { return this.state.view.questions[this.state.cur]; }
  get locked(): boolean { return this.state.view.status === 'finalized'; }
  get done(): boolean { return this.state.view.graded === this.state.view.total; }
  /** Ungraded blank answers of the question on screen. */
  get blankUngraded(): GradingAnswer[] { return (this.question?.answers ?? []).filter(a => a.manualScore === null && isBlank(a)); }

  select(index: number): void { this.set({ cur: index }); }
  setBlind(blind: boolean): void { this.set({ blind }); }
  askFinalize(): void { this.set({ confirming: true }); }
  cancelFinalize(): void { this.set({ confirming: false }); }

  /** Merge one graded answer into the view and refresh the counters from the server's answer. */
  private applySaved(r: GradeResponse): void {
    const v = this.state.view;
    this.set({ view: { ...v, graded: r.graded, total: r.total, questions: v.questions.map(x => ({ ...x, answers: x.answers.map(a => (a.answerId === r.answer.answerId ? r.answer : a)) })) } });
  }

  /** Save one answer's grade (used by the answer cards). Rejects with the server error so the card can show it. */
  async grade(answerId: number, score: number, feedback: string): Promise<void> {
    this.applySaved(await this.gateway.grade(answerId, { score, feedback }));
  }

  async zeroBlanks(): Promise<void> {
    this.set({ zeroing: true, error: '' });
    try { for (const a of this.blankUngraded) this.applySaved(await this.gateway.grade(a.answerId, { score: 0 })); }
    catch (err) { this.set({ error: errorText(err, 'Không chấm được các bài bỏ trống') }); }
    finally { this.set({ zeroing: false }); }
  }

  /** True when the session is finalized (the page then returns to the session). */
  async finalize(): Promise<boolean> {
    this.set({ finalizing: true, error: '' });
    try { await this.gateway.finalize(this.sessionId); return true; }
    catch (err) { this.set({ error: errorText(err, 'Không chốt được kết quả'), confirming: false, finalizing: false }); return false; }
  }
}

export const gradingErrorText = errorText;
