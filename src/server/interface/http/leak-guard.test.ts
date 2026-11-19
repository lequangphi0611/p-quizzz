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
  a.get('/api/me-email', async () => ({ participant: { displayName: 'An', email: 'an@x.com' } }));
  a.get('/api/emails', async () => ({ emails: ['an@x.com'] }));
  a.get('/api/admin/groups/1', async () => ({ emails: ['an@x.com'] }));
  a.get('/api/me/attempts/:id/review-with-email', async () => ({}));
  a.get('/api/text', async (_req, reply) => reply.type('text/plain').send('"isCorrect": true'));
  return a;
}

describe('leak guard: emails are mentor-only (PRODUCT.md §7.24)', () => {
  it.each(['/api/me-email', '/api/emails'])('blocks %s with a 500 and no address in the body', async url => {
    const res = await app().inject({ url });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toMatch(/an@x\.com|email/);
  });

  it('leaves the mentor routes alone', async () => {
    expect((await app().inject({ url: '/api/admin/groups/1' })).statusCode).toBe(200);
  });

  it('the review route may carry the answer key but never an email', async () => {
    const a = Fastify();
    registerLeakGuard(a);
    a.get('/api/me/attempts/:id/review', async () => ({ questions: [{ options: [{ isCorrect: true }] }], participant: { email: 'an@x.com' } }));
    const res = await a.inject({ url: '/api/me/attempts/7/review' });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('an@x.com');
  });

  it('does not trip on the word "email" inside text a member typed (quotes are escaped)', async () => {
    const a = Fastify();
    registerLeakGuard(a);
    a.get('/api/essay', async () => ({ textAnswer: 'send an "email": done' }));
    expect((await a.inject({ url: '/api/essay' })).statusCode).toBe(200);
  });
});

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

describe("leak guard: the class's reasons are mentor-only (PRODUCT.md §7.32e)", () => {
  it('blocks `reasons` outside /api/admin, review route included', async () => {
    const a = Fastify();
    registerLeakGuard(a);
    a.get('/api/sessions/:id/public', async () => ({ reasons: [{ optionIds: [1], text: 'vì vậy' }] }));
    a.get('/api/me/attempts/:id/review', async () => ({ questions: [{ reasons: [] }] }));
    a.get('/api/admin/sessions/:id/discussion', async () => ({ questions: [{ reasons: [{ optionIds: [1], text: 'vì vậy' }] }] }));
    a.get('/api/me/attempts/:id', async () => ({ answers: [{ reasonText: 'của tôi' }] }));
    expect((await a.inject({ url: '/api/sessions/1/public' })).statusCode).toBe(500);
    expect((await a.inject({ url: '/api/me/attempts/1/review' })).statusCode).toBe(500);
    expect((await a.inject({ url: '/api/admin/sessions/1/discussion' })).statusCode).toBe(200);
    expect((await a.inject({ url: '/api/me/attempts/1' })).statusCode).toBe(200); // a member's own reason is fine
  });
});

describe('leak guard: the share page (PRODUCT.md §7.33)', () => {
  const shareApp = (body: object) => {
    const a = Fastify();
    registerLeakGuard(a);
    a.get('/api/shared/:token/sessions/:id', async () => body);
    return a;
  };

  it('may carry the key and explanations', async () => {
    const res = await shareApp({ questions: [{ explanation: 'why', options: [{ isCorrect: true }], distribution: { counts: { 1: 2 }, blank: 0 } }] }).inject({ url: '/api/shared/t/sessions/1' });
    expect(res.statusCode).toBe(200);
  });

  it.each([{ displayName: 'An' }, { participants: [] }, { textAnswer: 'x' }, { reasonText: 'x' }, { feedback: 'x' }, { score: 1 }, { selectedOptionIds: [1] }, { name: 'Phiên nhóm A' }])(
    'blocks anything about one person: %o',
    async extra => {
      const res = await shareApp({ questions: [], ...extra }).inject({ url: '/api/shared/t/sessions/1' });
      expect(res.statusCode).toBe(500);
    },
  );
});
