import { buildApp } from '../app.js';
import { createDb, type Db } from '../db/client.js';
import { exams, options, questions } from '../db/schema.js';

// App + in-memory DB (already migrated) for route tests.
export async function createTestApp() {
  const db = createDb(':memory:');
  const app = await buildApp({ db });
  return { app, db };
}

export type ExamOverrides = Partial<typeof exams.$inferInsert>;

// Seeds one exam with a single, a multi and an essay question. Returns the exam row.
export function seedExam(db: Db, overrides: ExamOverrides = {}) {
  const exam = db
    .insert(exams)
    .values({
      title: 'Seed exam',
      sourceMarkdown: '# Seed exam',
      totalPoints: 7,
      hasEssay: true,
      createdAt: new Date(),
      ...overrides,
    })
    .returning()
    .get();

  const qs = db
    .insert(questions)
    .values([
      { examId: exam.id, position: 1, type: 'single', prompt: 'Single?', points: 1 },
      { examId: exam.id, position: 2, type: 'multi', prompt: 'Multi?', points: 2 },
      { examId: exam.id, position: 3, type: 'essay', prompt: 'Essay?', points: 4 },
    ])
    .returning()
    .all();
  const single = qs[0]!;
  const multi = qs[1]!;

  db.insert(options)
    .values([
      { questionId: single.id, position: 1, text: 'A', isCorrect: true },
      { questionId: single.id, position: 2, text: 'B' },
      { questionId: multi.id, position: 1, text: 'A', isCorrect: true },
      { questionId: multi.id, position: 2, text: 'B', isCorrect: true },
      { questionId: multi.id, position: 3, text: 'C' },
    ])
    .run();

  return exam;
}
