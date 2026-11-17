import type { GradeResponse, GradingAnswer, GradingQuestion, GradingView } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { isBlank } from '../domain/grading-ui.js';
import { aiCounts, failedIds, needsPolling, unsentIds, type AnswerFilter } from '../domain/ai-ui.js';
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
  /** Card filter (Tất cả / Chờ xác nhận / Nghi ngờ / Lỗi). */
  filter: AnswerFilter;
  /** Suspicious answers the mentor ticked "Đã đọc toàn bộ bài" for (this browser only). */
  acks: ReadonlySet<number>;
  /** Answers graded while the current filter is on: they stay visible (with "Hoàn tác") until the filter or question changes. */
  kept: ReadonlySet<number>;
  /** A request to start, retry or stop the AI is on its way. */
  aiBusy: boolean;
  /** Polite screen-reader message: when a run starts and when it ends. */
  live: string;
}

/** State and actions of the essay-grading page. Plain TypeScript, tested with a fake gateway. */
export class GradingController {
  private state: GradingState;
  private listeners = new Set<() => void>();

  constructor(private gateway: GradingGateway, private sessionId: number, initial: GradingView) {
    this.state = { view: initial, cur: 0, blind: true, error: '', zeroing: false, confirming: false, finalizing: false, filter: 'all', kept: new Set(), acks: new Set(), aiBusy: false, live: '' };
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

  select(index: number): void { this.set({ cur: index, filter: 'all', kept: new Set() }); }
  setFilter(filter: AnswerFilter): void { this.set({ filter, kept: new Set() }); }
  setAck(answerId: number, read: boolean): void { const acks = new Set(this.state.acks); if (read) acks.add(answerId); else acks.delete(answerId); this.set({ acks }); }
  /** Keep refreshing while a suggestion is queued or running. */
  get polling(): boolean { return needsPolling(this.state.view); }
  setBlind(blind: boolean): void { this.set({ blind }); }
  askFinalize(): void { this.set({ confirming: true }); }
  cancelFinalize(): void { this.set({ confirming: false }); }

  /** Merge one graded answer into the view and refresh the counters from the server's answer. */
  private applySaved(r: GradeResponse): void {
    const v = this.state.view;
    this.set({ view: { ...v, graded: r.graded, total: r.total, questions: v.questions.map(x => ({ ...x, answers: x.answers.map(a => (a.answerId === r.answer.answerId ? r.answer : a)) })) } });
  }

  /** Save one answer's grade (used by the answer cards). Rejects with the server error so the card can show it. */
  async grade(answerId: number, score: number, feedback: string, aiUse?: 'accepted' | 'edited'): Promise<void> {
    const r = await this.gateway.grade(answerId, aiUse ? { score, feedback, aiUse } : { score, feedback });
    if (this.state.filter !== 'all') this.set({ kept: new Set(this.state.kept).add(answerId) });
    this.applySaved(r);
  }

  private find(answerId: number): GradingAnswer | undefined {
    return this.state.view.questions.flatMap(q => q.answers).find(a => a.answerId === answerId);
  }

  /** "Dùng gợi ý": one tap saves the suggestion as the grade. A suspicious answer needs "Đã đọc toàn bộ bài" first. */
  async accept(answerId: number): Promise<void> {
    const a = this.find(answerId);
    const s = a?.aiSuggestion;
    if (!a || s?.status !== 'done' || s.score === null) return;
    if (s.suspicious && !this.state.acks.has(answerId)) return;
    await this.grade(answerId, s.score, s.feedback ?? '', 'accepted');
  }

  /** "Hoàn tác": the answer goes back to ungraded. Rejects with the server error so the card can show it. */
  async undo(answerId: number): Promise<void> {
    this.applySaved(await this.gateway.clearGrade(answerId));
  }

  /** Fresh view from the server (polling while the AI works). Announces when a question's run has finished. */
  async refresh(): Promise<void> {
    const before = this.state.view;
    let next: GradingView;
    try { next = await this.gateway.getGrading(this.sessionId); } catch { return; }
    const done = next.questions.find(q => { const prev = before.questions.find(p => p.id === q.id); return prev && aiCounts(prev).running && !aiCounts(q).running; });
    if (done) {
      const c = aiCounts(done);
      this.set({ view: next, live: `AI đã gợi ý xong câu ${done.position}: ${c.ok} trên ${c.sent} bài${c.flagPending ? `, ${c.flagPending} bài nghi ngờ` : ''}${c.errPending ? `, ${c.errPending} bài lỗi` : ''}.` });
    } else this.set({ view: next });
  }

  private async aiAction(run: () => Promise<unknown>, fallback: string, live?: string): Promise<void> {
    this.set({ aiBusy: true, error: '' });
    try {
      await run();
      await this.refresh();
      if (live) this.set({ live });
    } catch (err) { this.set({ error: errorText(err, fallback) }); }
    finally { this.set({ aiBusy: false }); }
  }

  /** "AI chấm nháp" for the question on screen. */
  runAi(): Promise<void> {
    const q = this.question;
    if (!q) return Promise.resolve();
    // Explicit ids: without them the server would also retry the failed answers, which the strip does not announce.
    const ids = unsentIds(q);
    return this.aiAction(() => this.gateway.requestAi(this.sessionId, q.id, ids), 'Không bắt đầu được AI chấm nháp', `AI bắt đầu chấm nháp ${ids.length} bài của câu ${q.position}. Bạn vẫn chấm tay được.`);
  }

  /** Retry one answer, or every failed answer of the question on screen. */
  retryAi(answerIds?: number[]): Promise<void> {
    const q = this.question;
    if (!q) return Promise.resolve();
    return this.aiAction(() => this.gateway.requestAi(this.sessionId, q.id, answerIds ?? failedIds(q)), 'Không thử lại được');
  }

  stopAi(): Promise<void> {
    const q = this.question;
    if (!q) return Promise.resolve();
    return this.aiAction(() => this.gateway.stopAi(this.sessionId, q.id), 'Không dừng được');
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
