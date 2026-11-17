import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CreateExamResponse, ExamDetail, ExamSummary } from '../../../shared/api/index.js';
import { parseExam, type ParseResult } from '../../../shared/exam-format/index.js';
import { exams, options, questions, sessions } from '../../infrastructure/db/schema.js';
import { createTestApp, loginAsMentor, seedExam } from '../helpers.js';

const sample = readFileSync('exams/examples/git-co-ban.md', 'utf8');
const broken = '---\ntitle: Hỏng\n---\n\n## Câu không có đáp án đúng\n- [ ] A\n- [ ] B\n';

async function setup() {
  const { app, db } = await createTestApp();
  const headers = await loginAsMentor(app);
  const post = (url: string, markdown: unknown) => app.inject({ method: 'POST', url, headers, payload: { markdown } });
  const counts = () => ({
    exams: db.select().from(exams).all().length,
    questions: db.select().from(questions).all().length,
    options: db.select().from(options).all().length,
  });
  return { app, db, headers, post, counts };
}

describe('exam routes — auth', () => {
  it('every route is 401 without the mentor cookie', async () => {
    const { app } = await createTestApp();
    for (const [method, url] of [
      ['POST', '/api/admin/exams/preview'],
      ['POST', '/api/admin/exams'],
      ['GET', '/api/admin/exams'],
      ['GET', '/api/admin/exams/1'],
      ['DELETE', '/api/admin/exams/1'],
    ] as const) {
      expect((await app.inject({ method, url, payload: method === 'POST' ? { markdown: sample } : undefined })).statusCode, url).toBe(401);
    }
  });
});

describe('POST /exams/preview', () => {
  it('returns the ParseResult for a valid file and does not save', async () => {
    const { post, counts } = await setup();
    const res = await post('/api/admin/exams/preview', sample);
    expect(res.statusCode).toBe(200);
    expect(res.json<ParseResult>()).toEqual(JSON.parse(JSON.stringify(parseExam(sample))));
    expect(res.json<ParseResult>().exam?.questions).toHaveLength(4);
    expect(counts().exams).toBe(0);
  });

  it('returns errors for an invalid file', async () => {
    const { post } = await setup();
    const body = (await post('/api/admin/exams/preview', broken)).json<ParseResult>();
    expect(body.exam).toBeNull();
    expect(body.errors.length).toBeGreaterThan(0);
    expect(body).toEqual(JSON.parse(JSON.stringify(parseExam(broken))));
  });

  it('rejects a missing or empty markdown field', async () => {
    const { post } = await setup();
    expect((await post('/api/admin/exams/preview', undefined)).statusCode).toBe(400);
    expect((await post('/api/admin/exams/preview', '')).statusCode).toBe(400);
  });
});

describe('POST /exams', () => {
  it('invalid markdown → 400 with errors, DB unchanged', async () => {
    const { post, counts } = await setup();
    const res = await post('/api/admin/exams', broken);
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: string; errors: { line: number; message: string }[] }>();
    expect(body.error).toBe('Đề có lỗi, chưa import được');
    expect(body.errors.length).toBeGreaterThan(0);
    expect(counts()).toEqual({ exams: 0, questions: 0, options: 0 });
  });

  it('imports the sample exam and the detail matches what the parser produced', async () => {
    const { app, headers, post } = await setup();
    const created = await post('/api/admin/exams', sample);
    expect(created.statusCode).toBe(201);
    const { exam, warnings } = created.json<CreateExamResponse>();
    expect(warnings).toEqual(parseExam(sample).warnings);
    expect(exam).toMatchObject({ title: 'Ôn tập Git cơ bản', questionCount: 4, totalPoints: 9, hasEssay: true, sessionCount: 0 });

    const parsed = parseExam(sample).exam!;
    const detail = (await app.inject({ url: `/api/admin/exams/${exam.id}`, headers })).json<ExamDetail>();
    expect(detail.sourceMarkdown).toBe(sample);
    expect(detail.questions.map(q => [q.position, q.type, q.points])).toEqual(parsed.questions.map((q, i) => [i + 1, q.type, q.points]));
    detail.questions.forEach((q, i) => {
      const p = parsed.questions[i]!;
      expect(q.prompt).toBe(p.prompt);
      expect(q.body).toBe(p.body);
      expect(q.explanation).toBe(p.explanation);
      expect(q.options.map(o => [o.position, o.text, o.isCorrect])).toEqual(p.options.map((o, j) => [j + 1, o.text, o.correct]));
    });
    expect(detail.questions.map(q => q.type)).toEqual(['single', 'multi', 'single', 'essay']);
    expect(detail.questions[3]!.options).toEqual([]);
  });

  it('rejects a body over 1 MB', async () => {
    const { post, counts } = await setup();
    const res = await post('/api/admin/exams', sample + '\n' + 'x'.repeat(1024 * 1024));
    expect(res.statusCode).toBe(413);
    expect(counts().exams).toBe(0);
  });
});

describe('GET /exams', () => {
  it('lists newest first with counts, without questions', async () => {
    const { app, db, headers } = await setup();
    const older = seedExam(db, { title: 'Older', createdAt: new Date(1000) });
    const newer = seedExam(db, { title: 'Newer', createdAt: new Date(2000) });
    db.insert(sessions).values({ examId: older.id, createdAt: new Date() }).run();

    const list = (await app.inject({ url: '/api/admin/exams', headers })).json<ExamSummary[]>();
    expect(list.map(e => e.title)).toEqual(['Newer', 'Older']);
    expect(list[0]).toEqual({
      id: newer.id, title: 'Newer', description: null, durationMinutes: null, questionCount: 3, totalPoints: 7, hasEssay: true, createdAt: 2000, sessionCount: 0,
    });
    expect(list[1]!.sessionCount).toBe(1);
    expect(Object.keys(list[0]!)).not.toContain('questions');
  });

  it('GET /exams/:id → 404 for unknown or malformed id', async () => {
    const { app, headers } = await setup();
    expect((await app.inject({ url: '/api/admin/exams/999', headers })).statusCode).toBe(404);
    expect((await app.inject({ url: '/api/admin/exams/abc', headers })).statusCode).toBe(404);
  });
});

describe('DELETE /exams/:id', () => {
  it('deletes an unused exam together with its questions and options', async () => {
    const { app, db, headers, counts } = await setup();
    const exam = seedExam(db);
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/exams/${exam.id}`, headers });
    expect(res.statusCode).toBe(204);
    expect(counts()).toEqual({ exams: 0, questions: 0, options: 0 });
  });

  it('is blocked with 409 when a session uses the exam', async () => {
    const { app, db, headers, counts } = await setup();
    const exam = seedExam(db);
    db.insert(sessions).values({ examId: exam.id, createdAt: new Date() }).run();
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/exams/${exam.id}`, headers });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'Đề đã được dùng cho phiên thi, không xoá được' });
    expect(counts().exams).toBe(1);
  });

  it('404 for an unknown exam', async () => {
    const { app, headers } = await setup();
    expect((await app.inject({ method: 'DELETE', url: '/api/admin/exams/999', headers })).statusCode).toBe(404);
  });
});

describe('immutability', () => {
  it('has no update route for exams', async () => {
    const { app, db, headers } = await setup();
    const exam = seedExam(db);
    for (const method of ['PUT', 'PATCH'] as const) {
      const res = await app.inject({ method, url: `/api/admin/exams/${exam.id}`, headers, payload: { markdown: sample } });
      expect(res.statusCode).toBe(404);
    }
  });
});
