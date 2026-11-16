import type { NewSession, Session, SessionPatch } from '../../domain/session/session.js';
import type {
  ActiveSessionView,
  AttemptAutoSubmitter,
  SessionDetailView,
  SessionReader,
  SessionRepository,
  SessionSummaryView,
  UngradedEssayCounter,
} from '../ports/session-repository.js';
import type { InMemoryExamRepository } from './in-memory-exam-repository.js';
import type { Snapshottable } from './in-memory-unit-of-work.js';

/** Test double for the sessions ports. Reads need the exam repository for titles. Participants are not modelled. */
export class InMemorySessionRepository implements SessionRepository, SessionReader, Snapshottable {
  private sessions = new Map<number, Session>();
  private nextId = 1;

  constructor(private readonly exams: InMemoryExamRepository) {}

  async findById(id: number) {
    return this.sessions.get(id) ?? null;
  }

  async create(s: NewSession) {
    const id = this.nextId++;
    this.sessions.set(id, { ...s, id, status: 'draft', roomCode: null, openedAt: null, startedAt: null, closedAt: null, finalizedAt: null });
    return id;
  }

  async update(id: number, patch: SessionPatch) {
    this.sessions.set(id, { ...this.sessions.get(id)!, ...patch });
  }

  async hasActiveOtherThan(id: number) {
    return [...this.sessions.values()].some(s => s.id !== id && (s.status === 'lobby' || s.status === 'running'));
  }

  async roomCodeInUse(code: string) {
    return [...this.sessions.values()].some(s => s.roomCode === code);
  }

  async exists(id: number) {
    return this.sessions.has(id);
  }

  async list() {
    const all = await Promise.all([...this.sessions.keys()].map(id => this.summary(id)));
    return all.filter((s): s is SessionSummaryView => !!s).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);
  }

  async findDetail(id: number): Promise<SessionDetailView | null> {
    const summary = await this.summary(id);
    const exam = summary && (await this.exams.findSummary(summary.examId));
    if (!summary || !exam) return null;
    return { ...summary, exam: { id: exam.id, title: exam.title, hasEssay: exam.hasEssay, totalPoints: exam.totalPoints }, participants: [] };
  }

  async findActive(): Promise<ActiveSessionView | null> {
    return this.view(s => s.status === 'lobby' || s.status === 'running');
  }

  async findActiveRoomCode() {
    return [...this.sessions.values()].filter(s => s.status === 'lobby' || s.status === 'running').sort((a, b) => b.id - a.id)[0]?.roomCode ?? null;
  }

  async findLatest(): Promise<ActiveSessionView | null> {
    return (await this.findActive()) ?? this.view(s => s.status === 'closed' || s.status === 'finalized');
  }

  snapshot() {
    return { sessions: new Map(this.sessions), nextId: this.nextId };
  }

  restore(snapshot: unknown) {
    const s = snapshot as ReturnType<InMemorySessionRepository['snapshot']>;
    this.sessions = s.sessions;
    this.nextId = s.nextId;
  }

  private async view(match: (s: Session) => boolean): Promise<ActiveSessionView | null> {
    const found = [...this.sessions.values()].filter(match).sort((a, b) => b.id - a.id)[0];
    const exam = found && (await this.exams.findSummary(found.examId));
    return found && exam ? { id: found.id, title: exam.title, status: found.status } : null;
  }

  private async summary(id: number): Promise<SessionSummaryView | null> {
    const s = this.sessions.get(id);
    const exam = s && (await this.exams.findSummary(s.examId));
    return s && exam ? { ...s, examTitle: exam.title, participantCount: 0 } : null;
  }
}

/** Stands in for the attempts module: says how many attempts it "submitted" and remembers it was called. */
export class FakeAttemptAutoSubmitter implements AttemptAutoSubmitter {
  readonly calls: number[] = [];

  constructor(public result = 0) {}

  async submitOpenAttempts(sessionId: number) {
    this.calls.push(sessionId);
    return this.result;
  }
}

export class FakeUngradedEssayCounter implements UngradedEssayCounter {
  constructor(public missing = 0) {}

  async count() {
    return this.missing;
  }
}
