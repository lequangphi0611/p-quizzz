import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerLeakGuard } from './leak-guard.js';

function app() {
  const a = Fastify();
  registerLeakGuard(a);
  a.get('/api/leaky', async () => ({ id: 1, isCorrect: true }));
  a.get('/api/snake', async () => ({ options: [{ text: 'A', is_correct: false }] }));
  a.get('/api/nested', async () => [{ q: { explanation: 'because' } }]);
  a.get('/api/fine', async () => ({ text: 'the explanation is below', isCorrectAnswer: 'no such key', note: 'isCorrect' }));
  // A member typing JSON-looking text into an essay must not trip the guard: the quotes are escaped in the payload.
  a.get('/api/essay', async () => ({ textAnswer: '{"isCorrect": true, "explanation": "x"}' }));
  a.get('/api/admin/exams/1', async () => ({ options: [{ isCorrect: true }], explanation: 'mentor view' }));
  a.get('/api/me/attempts/:id/review', async () => ({ questions: [{ options: [{ isCorrect: true }], explanation: 'after close' }] }));
  a.get('/api/text', async (_req, reply) => reply.type('text/plain').send('"isCorrect": true'));
  return a;
}

describe('leak guard', () => {
  it.each(['/api/leaky', '/api/snake', '/api/nested'])('blocks %s with a 500 and no key in the body', async url => {
    const res = await app().inject({ url });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'Lỗi máy chủ' });
    expect(res.body).not.toMatch(/isCorrect|is_correct|explanation|because/);
  });

  it('lets ordinary responses through, including look-alike words and escaped text', async () => {
    for (const url of ['/api/fine', '/api/essay']) expect((await app().inject({ url })).statusCode, url).toBe(200);
  });

  it('leaves the mentor routes and the review route alone', async () => {
    expect((await app().inject({ url: '/api/admin/exams/1' })).statusCode).toBe(200);
    expect((await app().inject({ url: '/api/me/attempts/7/review' })).statusCode).toBe(200);
  });

  it('only inspects JSON', async () => {
    expect((await app().inject({ url: '/api/text' })).statusCode).toBe(200);
  });

  it('content-length matches the replaced body', async () => {
    const res = await app().inject({ url: '/api/leaky' });
    expect(Number(res.headers['content-length'])).toBe(Buffer.byteLength(res.body));
  });
});
