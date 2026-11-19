import { REASON_MISSING_CODE, type AttemptView, type MemberQuestion } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { draftOf, draftsFromAnswers, nextSelection, withChoice, withReason, withText, type Drafts } from '../domain/answer-progress.js';
import { AnswerSaver, type SaveState } from './answer-saver.js';
import type { ExamGateway } from './exam-gateway.js';

export const errorText = (err: unknown, fallback: string): string => (err instanceof ApiError ? err.message : fallback);

export interface TakingState {
  view: AttemptView | null;
  loadError: string;
  drafts: Drafts;
  /** Index of the question on screen. */
  cur: number;
  save: SaveState;
  /** The "Nộp bài?" dialog is open. */
  confirming: boolean;
  submitting: boolean;
  submitError: string;
  /** The server refused a save with 409: the session closed or the attempt is already submitted. */
  closed: boolean;
  /** The session clock reached 00:00 (PRODUCT.md §7.27): work is being sent, the session is about to close itself. */
  timeUp: boolean;
}

export const initialTakingState = (): TakingState => ({ view: null, loadError: '', drafts: {}, cur: 0, save: 'saved', confirming: false, submitting: false, submitError: '', closed: false, timeUp: false });

export interface TakingDeps {
  gateway: ExamGateway;
  attemptId: number;
  /** Called when the parent must refetch `/api/me` (session closed, attempt submitted). */
  onChanged: () => Promise<void>;
}

/**
 * Orchestrates one attempt on screen: loads it, keeps the drafts, autosaves through AnswerSaver, moves between
 * questions and submits. Plain TypeScript (no React, no DOM) so it is tested with a fake ExamGateway;
 * `useTakingExam` only connects it to React.
 */
export class TakingController {
  private state = initialTakingState();
  private listeners = new Set<() => void>();
  private saver: AnswerSaver;
  private sessionEnded = false;

  constructor(private deps: TakingDeps) {
    this.saver = new AnswerSaver(
      async (questionId, payload) => {
        try { await deps.gateway.saveAnswer(deps.attemptId, questionId, payload); }
        catch (err) {
          if (err instanceof ApiError && err.status === 409) { this.sessionEnded = true; this.set({ closed: true }); void deps.onChanged(); }
          throw err;
        }
      },
      save => this.set({ save }),
    );
  }

  // Arrow properties: stable identities for useSyncExternalStore.
  getState = (): TakingState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private set(patch: Partial<TakingState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) l();
  }

  async load(): Promise<void> {
    this.set({ loadError: '' });
    try {
      const view = await this.deps.gateway.getAttempt(this.deps.attemptId);
      this.set({ drafts: draftsFromAnswers(view.answers), view });
    } catch (err) { this.set({ loadError: errorText(err, 'Không tải được bài làm') }); }
  }

  pick(question: MemberQuestion, optionId: number): void {
    if (question.type === 'essay') return;
    const selected = nextSelection(question.type, this.state.drafts[question.id]?.selected ?? [], optionId);
    this.set({ drafts: withChoice(this.state.drafts, question.id, selected) });
    this.saver.queue(question.id, this.choicePayload(question, selected));
  }

  /** Reason box of a `{reason}` question (PRODUCT.md §7.32): saved after a quiet period, together with the current pick. */
  setReason(question: MemberQuestion, reason: string): void {
    if (question.type === 'essay' || !question.requireReason) return;
    this.set({ drafts: withReason(this.state.drafts, question.id, reason) });
    this.saver.queue(question.id, this.choicePayload(question, draftOf(this.state.drafts, question.id).selected), true);
  }

  // A `{reason}` question always sends the pick and the reason together, so neither overwrites the other on the wire.
  private choicePayload(question: MemberQuestion, selected: number[]) {
    return question.requireReason ? { selectedOptionIds: selected, reasonText: draftOf(this.state.drafts, question.id).reason } : { selectedOptionIds: selected };
  }

  setText(questionId: number, text: string): void {
    this.set({ drafts: withText(this.state.drafts, questionId, text) });
    this.saver.queue(questionId, { textAnswer: text }, true);
  }

  /** Go to question `index` (0-based). Flushes first so typed text is not left on the debounce. */
  go(index: number): void {
    const total = this.state.view?.questions.length ?? 0;
    if (index < 0 || index >= total) return;
    void this.saver.flushAll();
    this.set({ cur: index });
  }

  retrySave(): Promise<boolean> { return this.saver.retry(); }

  /**
   * The clock reached 00:00: send what is still pending right away (the server accepts it for a few more seconds),
   * then wait for the session to close itself; the parent refetches and shows the result.
   */
  timeUp(): void {
    if (this.state.timeUp) return;
    this.set({ timeUp: true, confirming: false });
    void this.saver.flushAll().finally(() => { void this.deps.onChanged(); });
  }

  /** The mentor added time ("+N phút") after the clock hit 00:00 but before the session closed: back to work. */
  timeResumed(): void {
    if (this.state.timeUp) this.set({ timeUp: false });
  }

  /** True when leaving the page would lose answers. After a 409 nothing more can be saved, so never trap the member. */
  hasUnsavedWork(): boolean { return !this.sessionEnded && this.saver.state !== 'saved'; }

  requestSubmit(): void { this.set({ confirming: true }); }
  cancelSubmit(): void { this.set({ confirming: false }); }

  async submit(): Promise<void> {
    this.set({ submitting: true, submitError: '' });
    try {
      if (!(await this.saver.flushAll())) throw new Error('unsaved');
      await this.deps.gateway.submitAttempt(this.deps.attemptId);
      await this.deps.onChanged();
    } catch (err) {
      // reason_missing: another tab or an old draft left a pick without a reason; the dialog lists the questions again.
      const missingReason = err instanceof ApiError && err.code === REASON_MISSING_CODE;
      this.set({ confirming: missingReason, submitError: missingReason ? '' : err instanceof ApiError ? err.message : 'Còn câu chưa lưu được. Kiểm tra mạng rồi thử nộp lại.', submitting: false });
    }
  }

  /** Leaving the screen: send what is pending, then stop the timers. */
  dispose(): void { void this.saver.flushAll().finally(() => this.saver.dispose()); }
}
