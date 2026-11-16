import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { newExam } from '../../domain/exam/exam.js';
import { parseExam } from '../../../shared/exam-format/index.js';
import type { ExamUnitContext } from '../../application/ports/exam-repository.js';
import { createDb } from './client.js';
import { exams, options, questions } from './schema.js';
import { DrizzleExamRepository } from './drizzle-exam-repository.js';
import { SqliteDatabase, SqliteUnitOfWork } from './sqlite-database.js';

const sample = readFileSync('exams/examples/git-co-ban.md', 'utf8');

function setup() {
  const db = createDb(':memory:');
  const database = new SqliteDatabase(db);
  const reader = new DrizzleExamRepository(fn => database.read(fn));
  const unitOfWork = new SqliteUnitOfWork<ExamUnitContext>(database, tx => ({ exams: new DrizzleExamRepository(async fn => fn(tx)) }));
  const counts = () => ({
    exams: db.select().from(exams).all().length,
    questions: db.select().from(questions).all().length,
    options: db.select().from(options).all().length,
  });
  const parsed = parseExam(sample).exam!;
  const input = { ...parsed, sourceMarkdown: sample, createdAt: new Date(7) };
  return { reader, unitOfWork, counts, input };
}

describe('DrizzleExamRepository', () => {
  it('round-trips an exam with questions and options in position order', async () => {
    const { reader, unitOfWork, input } = setup();
    const id = await unitOfWork.run(ctx => ctx.exams.add(newExam(input)));

    const exam = (await reader.findById(id))!;
    expect(exam).toMatchObject({ title: input.title, sourceMarkdown: sample, createdAt: new Date(7), totalPoints: 9, hasEssay: true });
    expect(exam.questions.map(q => [q.position, q.type, q.points])).toEqual(input.questions.map((q, i) => [i + 1, q.type, q.points]));
    expect(exam.questions[0]!.options.map(o => [o.position, o.text, o.isCorrect])).toEqual(
      input.questions[0]!.options.map((o, i) => [i + 1, o.text, o.correct]),
    );
    expect(await reader.findSummary(id)).toMatchObject({ questionCount: 4, sessionCount: 0 });
    expect(await reader.findById(999)).toBeNull();
    expect(await reader.findSummary(999)).toBeNull();
  });

  it('a failing insert mid-way leaves no partial data', async () => {
    const { unitOfWork, counts, input } = setup();
    const good = newExam(input);
    // Second question has a NULL prompt → NOT NULL violation after the exam, question 1 and its options were written.
    const bad = { ...good, questions: [good.questions[0]!, { ...good.questions[1]!, prompt: null as unknown as string }] };
    await expect(unitOfWork.run(ctx => ctx.exams.add(bad))).rejects.toThrow();
    expect(counts()).toEqual({ exams: 0, questions: 0, options: 0 });
  });

  it('remove deletes the exam with its questions and options', async () => {
    const { reader, unitOfWork, counts, input } = setup();
    const id = await unitOfWork.run(ctx => ctx.exams.add(newExam(input)));
    await unitOfWork.run(ctx => ctx.exams.remove(id));
    expect(counts()).toEqual({ exams: 0, questions: 0, options: 0 });
    expect(await reader.list()).toEqual([]);
  });
});
