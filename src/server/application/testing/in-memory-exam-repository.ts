import type { Exam, NewExam } from '../../domain/exam/exam.js';
import type { ExamRepository, ExamSummary } from '../ports/exam-repository.js';
import type { Snapshottable } from './in-memory-unit-of-work.js';

/** Test double for `ExamRepository`: keeps exams in memory, no database. */
export class InMemoryExamRepository implements ExamRepository, Snapshottable {
  private exams = new Map<number, Exam>();
  private sessionCounts = new Map<number, number>();
  private nextId = 1;
  /** Set to make `add` throw after it has stored the exam, to test rollback. */
  failAfterAdd: Error | null = null;

  async add(exam: NewExam): Promise<number> {
    const id = this.nextId++;
    let childId = id * 1000;
    this.exams.set(id, {
      ...exam,
      id,
      questions: exam.questions.map(q => ({ ...q, id: ++childId, options: q.options.map(o => ({ ...o, id: ++childId })) })),
    });
    if (this.failAfterAdd) throw this.failAfterAdd;
    return id;
  }

  async remove(id: number): Promise<void> {
    this.exams.delete(id);
  }

  async list(): Promise<ExamSummary[]> {
    return [...this.exams.keys()]
      .map(id => this.summary(id)!)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);
  }

  async findSummary(id: number): Promise<ExamSummary | null> {
    return this.summary(id);
  }

  async findById(id: number): Promise<Exam | null> {
    return this.exams.get(id) ?? null;
  }

  async findQuestion(questionId: number) {
    for (const e of this.exams.values()) {
      const q = e.questions.find(x => x.id === questionId);
      if (q) return { id: q.id, type: q.type, points: q.points, requireReason: q.requireReason, optionIds: q.options.map(o => o.id) };
    }
    return null;
  }

  async maxAutoScoreOf(examId: number) {
    return (this.exams.get(examId)?.questions ?? []).filter(q => q.type !== 'essay').reduce((sum, q) => sum + q.points, 0);
  }

  /** Test helper: pretend `count` sessions were run from this exam. */
  setSessionCount(id: number, count: number) {
    this.sessionCounts.set(id, count);
  }

  snapshot() {
    return { exams: new Map(this.exams), nextId: this.nextId };
  }

  restore(snapshot: unknown) {
    const s = snapshot as ReturnType<InMemoryExamRepository['snapshot']>;
    this.exams = s.exams;
    this.nextId = s.nextId;
  }

  private summary(id: number): ExamSummary | null {
    const e = this.exams.get(id);
    if (!e) return null;
    const { questions, ...rest } = e;
    const { sourceMarkdown: _source, ...fields } = rest;
    return { ...fields, questionCount: questions.length, sessionCount: this.sessionCounts.get(id) ?? 0 };
  }
}
