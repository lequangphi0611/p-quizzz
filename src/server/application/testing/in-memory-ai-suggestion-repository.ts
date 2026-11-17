import type { AiSuggestionRepository, SuggestionQueue } from '../ports/ai-suggestion-repository.js';
import type { EssayGrader, EssayGradingInput } from '../ports/essay-grader.js';
import { EssayGraderError } from '../ports/essay-grader.js';
import type { AiSuggestion, AiUse, RawSuggestion } from '../../domain/grading/ai-suggestion.js';
import type { Snapshottable } from './in-memory-unit-of-work.js';

const EMPTY = { score: null, feedback: null, criteria: null, suspicious: false, suspiciousReason: null, suspiciousLines: null, error: null, model: null, used: null, finishedAt: null };

/** `ai_suggestions` in memory. `sessionOfAnswer` stands in for the joins the real one does. */
export class InMemoryAiSuggestionRepository implements AiSuggestionRepository, Snapshottable {
  rows = new Map<number, AiSuggestion>();
  private nextId = 1;

  constructor(private readonly sessionOfAnswer: (answerId: number) => number | undefined = () => undefined) {}

  snapshot() {
    return { rows: new Map(this.rows), nextId: this.nextId };
  }

  restore(s: unknown) {
    const snap = s as { rows: Map<number, AiSuggestion>; nextId: number };
    this.rows = new Map(snap.rows);
    this.nextId = snap.nextId;
  }

  byAnswer(answerId: number) {
    return [...this.rows.values()].find(r => r.answerId === answerId);
  }

  async findById(id: number) {
    return this.rows.get(id) ?? null;
  }

  async listByAnswerIds(answerIds: number[]) {
    return [...this.rows.values()].filter(r => answerIds.includes(r.answerId));
  }

  async anyDoneInSession(sessionId: number) {
    return [...this.rows.values()].some(r => r.status === 'done' && this.sessionOfAnswer(r.answerId) === sessionId);
  }

  async queue(answerIds: number[], requestedAt: Date) {
    return answerIds.map(answerId => {
      const existing = this.byAnswer(answerId);
      const id = existing?.id ?? this.nextId++;
      this.rows.set(id, { id, answerId, status: 'queued', requestedAt, ...EMPTY });
      return id;
    });
  }

  private patch(id: number, p: Partial<AiSuggestion>) {
    const r = this.rows.get(id);
    if (r) this.rows.set(id, { ...r, ...p });
  }

  async markRunning(id: number) {
    this.patch(id, { status: 'running' });
  }

  async complete(id: number, s: RawSuggestion, finishedAt: Date) {
    this.patch(id, { status: 'done', ...s, error: null, finishedAt });
  }

  async fail(id: number, error: string, finishedAt: Date) {
    this.patch(id, { status: 'failed', error, finishedAt });
  }

  async removeQueued(answerIds: number[]) {
    let n = 0;
    for (const r of [...this.rows.values()])
      if (answerIds.includes(r.answerId) && r.status === 'queued') {
        this.rows.delete(r.id);
        n++;
      }
    return n;
  }

  async remove(id: number) {
    this.rows.delete(id);
  }

  async setUsed(answerId: number, used: AiUse | null) {
    const r = this.byAnswer(answerId);
    if (r) this.patch(r.id, { used });
  }

  async failUnfinished(error: string, at: Date) {
    let n = 0;
    for (const r of this.rows.values())
      if (r.status === 'queued' || r.status === 'running') {
        this.patch(r.id, { status: 'failed', error, finishedAt: at });
        n++;
      }
    return n;
  }
}

/** Records what was enqueued; the test runs them when it wants. */
export class RecordingSuggestionQueue implements SuggestionQueue {
  readonly enqueued: number[] = [];
  enqueue(ids: number[]) {
    this.enqueued.push(...ids);
  }
}

/** Answers with a canned suggestion (or fails), remembering every input it was shown. */
export class FakeEssayGrader implements EssayGrader {
  readonly inputs: EssayGradingInput[] = [];
  isAvailable = true;
  next: ((input: EssayGradingInput) => RawSuggestion) | EssayGraderError = input => ({
    score: input.maxPoints,
    feedback: 'Tốt.',
    criteria: (input.rubricCriteria ?? [{ text: 'Tổng', points: input.maxPoints }]).map((c, i) => ({ label: `T${i + 1}`, score: c.points, max: c.points, note: 'Đủ ý.' })),
    suspicious: false,
    suspiciousReason: null,
    suspiciousLines: [],
    model: 'fake',
  });

  async available() {
    return this.isAvailable;
  }

  async suggest(input: EssayGradingInput) {
    this.inputs.push(input);
    if (this.next instanceof EssayGraderError) throw this.next;
    return this.next(input);
  }
}
