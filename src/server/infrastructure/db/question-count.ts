import { sql } from 'drizzle-orm';

/** Number of questions in the exam of the current `exams` row; select it from a query that has `exams` in scope. One definition for every reader. */
export const examQuestionCount = sql<number>`(select count(*) from questions where questions.exam_id = exams.id)`;
