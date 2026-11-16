import { NO_EDIT_REQUEST, type Answer, type Attempt, type EditStatus, type NewAttempt } from '../../domain/attempt/attempt.js';
import type { AttemptRepository, MemberRoom, MemberRoomReader } from '../ports/attempt-repository.js';
import type { InMemoryParticipantRepository } from './in-memory-participant-repository.js';
import type { Snapshottable } from './in-memory-unit-of-work.js';

/** Test double for the attempt ports. Needs the participant repository to tell active from kicked members. */
export class InMemoryAttemptRepository implements AttemptRepository, Snapshottable {
  private attempts = new Map<number, Attempt>();
  private answers = new Map<string, Answer>(); // `${attemptId}:${questionId}`
  private nextId = 1;
  private nextAnswerId = 1;

  constructor(private readonly participants: InMemoryParticipantRepository) {}

  async findById(id: number) {
    return this.attempts.get(id) ?? null;
  }

  async findAnswerById(answerId: number) {
    return [...this.answers.values()].find(a => a.id === answerId) ?? null;
  }

  async listSubmittedOfActiveMembers(sessionId: number) {
    const out: Attempt[] = [];
    for (const a of this.attempts.values()) {
      const p = await this.participants.findById(a.participantId);
      if (p && p.sessionId === sessionId && p.status === 'active' && a.submittedAt) out.push(a);
    }
    return out;
  }

  async answersOfAttempts(attemptIds: number[]) {
    return [...this.answers.values()].filter(a => attemptIds.includes(a.attemptId));
  }

  async gradeAnswer(answerId: number, grade: { manualScore: number; feedback: string | null; gradedAt: Date }) {
    const [key, existing] = [...this.answers].find(([, a]) => a.id === answerId)!;
    const updated = { ...existing, ...grade };
    this.answers.set(key, updated);
    return updated;
  }

  async setManualScore(attemptId: number, score: number) {
    this.attempts.set(attemptId, { ...this.attempts.get(attemptId)!, manualScore: score });
  }

  async findOwned(participantId: number, attemptId: number) {
    const a = this.attempts.get(attemptId);
    return a && a.participantId === participantId ? a : null;
  }

  async listByParticipant(participantId: number) {
    return [...this.attempts.values()].filter(a => a.participantId === participantId).sort((a, b) => a.attemptNo - b.attemptNo);
  }

  async answersOf(attemptId: number) {
    return [...this.answers.values()].filter(a => a.attemptId === attemptId);
  }

  async create(n: NewAttempt) {
    const attempt: Attempt = { ...n, id: this.nextId++, submittedAt: null, autoScore: null, manualScore: null, ...NO_EDIT_REQUEST };
    this.attempts.set(attempt.id, attempt);
    return attempt;
  }

  async listOpenOfActiveMembers(sessionId: number) {
    const out: Attempt[] = [];
    for (const a of this.attempts.values()) {
      const p = await this.participants.findById(a.participantId);
      if (p && p.sessionId === sessionId && p.status === 'active' && !a.submittedAt) out.push(a);
    }
    return out;
  }

  async markSubmitted(id: number, submittedAt: Date, autoScore: number) {
    this.attempts.set(id, { ...this.attempts.get(id)!, submittedAt, autoScore });
  }

  async setEditRequest(id: number, edit: { editStatus: EditStatus; editReason: string | null; editRequestedAt: Date | null; editResolvedAt: Date | null }) {
    this.attempts.set(id, { ...this.attempts.get(id)!, ...edit });
  }

  async saveAnswer(attemptId: number, questionId: number, value: { selectedOptionIds?: number[]; textAnswer?: string }) {
    const key = `${attemptId}:${questionId}`;
    const existing = this.answers.get(key);
    this.answers.set(key, { ...(existing ?? this.blank(attemptId, questionId)), ...value });
  }

  async recordAutoScores(attemptId: number, scores: { questionId: number; autoScore: number | null }[]) {
    for (const { questionId, autoScore } of scores) {
      const key = `${attemptId}:${questionId}`;
      this.answers.set(key, { ...(this.answers.get(key) ?? this.blank(attemptId, questionId)), autoScore });
    }
  }

  snapshot() {
    return { attempts: new Map(this.attempts), answers: new Map(this.answers), nextId: this.nextId, nextAnswerId: this.nextAnswerId };
  }

  restore(snapshot: unknown) {
    const s = snapshot as ReturnType<InMemoryAttemptRepository['snapshot']>;
    this.attempts = s.attempts;
    this.answers = s.answers;
    this.nextId = s.nextId;
    this.nextAnswerId = s.nextAnswerId;
  }

  private blank(attemptId: number, questionId: number): Answer {
    return { id: this.nextAnswerId++, attemptId, questionId, selectedOptionIds: null, textAnswer: null, autoScore: null, manualScore: null, feedback: null, gradedAt: null };
  }
}

export class FakeMemberRoomReader implements MemberRoomReader {
  constructor(public room: MemberRoom | null = null) {}

  async find() {
    return this.room;
  }
}
