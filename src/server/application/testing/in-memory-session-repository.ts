import type { NewSession, Session, SessionPatch } from '../../domain/session/session.js';
import type {
  ActiveSessionView,
  AttemptAutoSubmitter,
  ScreenSessionView,
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
  private rosters = new Map<number, string[]>();
  private nextId = 1;

  constructor(private readonly exams: InMemoryExamRepository) {}

  async findById(id: number) {
    return this.sessions.get(id) ?? null;
  }

  async create(s: NewSession) {
    const id = this.nextId++;
    this.sessions.set(id, { ...s, id, status: 'draft', scoresReleasedAt: null, slot: null, roomCode: null, openedAt: null, startedAt: null, closedAt: null, finalizedAt: null });
    return id;
  }

  async update(id: number, patch: SessionPatch) {
    this.sessions.set(id, { ...this.sessions.get(id)!, ...patch });
  }

  async lowestFreeSlot() {
    const used = new Set([...this.sessions.values()].filter(s => this.isOpen(s)).map(s => s.slot));
    let slot = 1;
    while (used.has(slot)) slot++;
    return slot;
  }

  async addRoster(sessionId: number, emails: readonly string[]) {
    const list = [...(this.rosters.get(sessionId) ?? [])];
    let added = 0;
    for (const e of emails) if (!list.includes(e)) { list.push(e); added++; }
    this.rosters.set(sessionId, list);
    return added;
  }

  async rosterEmails(sessionId: number) {
    return [...(this.rosters.get(sessionId) ?? [])];
  }

  async hasRosterEmail(sessionId: number, email: string) {
    return (this.rosters.get(sessionId) ?? []).includes(email);
  }

  async setSourceGroup(sessionId: number, groupId: number) {
    this.sessions.set(sessionId, { ...this.sessions.get(sessionId)!, sourceGroupId: groupId });
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
    const emails = this.rosters.get(id) ?? [];
    const roster = summary.access === 'roster' ? { size: emails.length, joined: 0, notJoined: [...emails] } : null; // participants are not modelled here
    return { ...summary, exam: { id: exam.id, title: exam.title, hasEssay: exam.hasEssay, totalPoints: exam.totalPoints, questionCount: exam.questionCount }, participants: [], roster, rejoinRequests: [] };
  }

  async listActive() {
    const open = [...this.sessions.values()].filter(s => this.isOpen(s)).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0) || a.id - b.id);
    const all = await Promise.all(open.map(s => this.summary(s.id)));
    return all.filter((s): s is SessionSummaryView => !!s);
  }

  async findPublic(id: number): Promise<ActiveSessionView | null> {
    return this.view(s => s.id === id);
  }

  async findOpenByRoomCode(code: string): Promise<ActiveSessionView | null> {
    return this.view(s => this.isOpen(s) && s.roomCode === code);
  }

  async findOpenRoomCode(id: number) {
    const s = this.sessions.get(id);
    return s && this.isOpen(s) ? s.roomCode : null;
  }

  async listScreenSessions(): Promise<ScreenSessionView[]> {
    const open = [...this.sessions.values()].filter(s => this.isOpen(s)).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0) || a.id - b.id);
    const rows = await Promise.all(open.map(s => this.screen(s)));
    return rows.filter((r): r is ScreenSessionView => !!r);
  }

  async findLatestEnded(): Promise<ScreenSessionView | null> {
    const ended = [...this.sessions.values()].filter(s => s.status === 'closed' || s.status === 'finalized').sort((a, b) => b.id - a.id)[0];
    return ended ? this.screen(ended) : null;
  }

  async rosterCounts(sessionId: number) {
    const s = this.sessions.get(sessionId);
    return s && s.access === 'roster' ? { joinedCount: 0, rosterSize: (this.rosters.get(sessionId) ?? []).length } : null;
  }

  snapshot() {
    return { sessions: new Map(this.sessions), rosters: new Map([...this.rosters].map(([k, v]): [number, string[]] => [k, [...v]])), nextId: this.nextId };
  }

  restore(snapshot: unknown) {
    const s = snapshot as ReturnType<InMemorySessionRepository['snapshot']>;
    this.sessions = s.sessions;
    this.rosters = s.rosters;
    this.nextId = s.nextId;
  }

  private isOpen(s: Session) {
    return s.status === 'lobby' || s.status === 'running';
  }

  private async screen(s: Session): Promise<ScreenSessionView | null> {
    const exam = await this.exams.findSummary(s.examId);
    return exam ? { id: s.id, name: s.name, slot: s.slot, title: exam.title, status: s.status } : null;
  }

  private async view(match: (s: Session) => boolean): Promise<ActiveSessionView | null> {
    const found = [...this.sessions.values()].filter(match).sort((a, b) => b.id - a.id)[0];
    const exam = found && (await this.exams.findSummary(found.examId));
    return found && exam ? { id: found.id, title: exam.title, status: found.status, access: found.access } : null;
  }

  private async summary(id: number): Promise<SessionSummaryView | null> {
    const s = this.sessions.get(id);
    const exam = s && (await this.exams.findSummary(s.examId));
    return s && exam ? { ...s, examTitle: exam.title, participantCount: 0, rosterSource: s.sourceGroupId !== null ? 'group' : s.access === 'roster' ? 'temp' : null } : null;
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
