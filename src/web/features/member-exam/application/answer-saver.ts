// Autosave engine for the exam-taking screen. Framework-free so its guarantees can be tested:
//  • a choice is sent at once, typed text after a quiet period (debounce) — rapid edits collapse into one request;
//  • per question only one request is in flight, and the newest value always goes last (no out-of-order overwrite);
//  • a failed save is remembered and retried automatically (2s, 5s, then every 10s) and on demand, never silently dropped;
//  • flushAll() lets "submit" and "next question" wait until everything typed is on the server.

export type SaveState = 'saved' | 'saving' | 'error';
export type AnswerPayload = { selectedOptionIds: number[]; reasonText?: string } | { textAnswer: string };
export type SendFn = (questionId: number, payload: AnswerPayload) => Promise<void>;

export class AnswerSaver {
  private latest = new Map<number, AnswerPayload>();
  private dirty = new Set<number>();
  private failed = new Set<number>();
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private running = new Map<number, Promise<void>>();
  private disposed = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryStep = 0;
  lastError: unknown = null;

  constructor(private send: SendFn, private onChange: (state: SaveState) => void = () => {}, private debounceMs = 500, private retryDelays: readonly number[] = [2000, 5000, 10000]) {}

  get state(): SaveState {
    if (this.failed.size > 0) return 'error';
    return this.dirty.size > 0 || this.running.size > 0 || this.timers.size > 0 ? 'saving' : 'saved';
  }

  private emit() { if (!this.disposed) this.onChange(this.state); }

  /** Record the newest value of a question. `debounce` for free text; choices are sent immediately. */
  queue(questionId: number, payload: AnswerPayload, debounce = false): void {
    this.latest.set(questionId, payload);
    this.dirty.add(questionId);
    const t = this.timers.get(questionId);
    if (t) clearTimeout(t);
    if (debounce) {
      this.timers.set(questionId, setTimeout(() => { this.timers.delete(questionId); void this.pump(questionId); }, this.debounceMs));
    } else {
      this.timers.delete(questionId);
      void this.pump(questionId);
    }
    this.emit();
  }

  // Sends the newest value; if more edits land meanwhile, loops so the newest is always last on the wire.
  private pump(questionId: number): Promise<void> {
    const existing = this.running.get(questionId);
    if (existing) return existing; // the running loop will pick up the newer value
    const run = (async () => {
      while (this.dirty.has(questionId) && !this.timers.has(questionId)) {
        this.dirty.delete(questionId);
        try {
          await this.send(questionId, this.latest.get(questionId)!);
          this.failed.delete(questionId);
          if (this.failed.size === 0) this.resetRetry();
        } catch (err) {
          this.lastError = err;
          this.failed.add(questionId);
          this.scheduleRetry();
          if (!this.dirty.has(questionId)) break; // nothing newer to try; stay failed until retry()
        }
        this.emit();
      }
    })().finally(() => { this.running.delete(questionId); this.emit(); });
    this.running.set(questionId, run);
    return run;
  }

  // Back off instead of hammering a server that is down; a restart or a dropped Wi-Fi heals without the member doing anything.
  private scheduleRetry(): void {
    if (this.disposed || this.retryTimer) return;
    const delay = this.retryDelays[Math.min(this.retryStep, this.retryDelays.length - 1)];
    this.retryStep++;
    this.retryTimer = setTimeout(() => { this.retryTimer = null; if (this.failed.size > 0) void this.retry(); }, delay);
  }

  private resetRetry(): void {
    this.retryStep = 0;
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
  }

  /** Send everything now (skipping the debounce wait) and wait. True when nothing is left unsaved. */
  async flushAll(): Promise<boolean> {
    for (const [qid, t] of this.timers) { clearTimeout(t); this.timers.delete(qid); }
    await Promise.all([...this.dirty].map(q => this.pump(q)));
    await Promise.all([...this.running.values()]);
    this.emit();
    return this.failed.size === 0 && this.dirty.size === 0;
  }

  /** Re-send questions whose last save failed. True when everything is saved afterwards. */
  async retry(): Promise<boolean> {
    for (const q of this.failed) this.dirty.add(q);
    this.emit();
    return this.flushAll();
  }

  dispose(): void {
    this.disposed = true;
    this.resetRetry();
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }
}
