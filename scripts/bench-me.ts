// Micro-benchmark for the hot member endpoint: `npx tsx scripts/bench-me.ts` (every member polls GET /api/me).
// In-memory DB, one member with an attempt in progress, N sequential requests through app.inject (no network).
import { createTestApp, loginAsMentor, seedExam } from '../src/server/test/helpers.js';

const N = 3000;
const { app, db } = await createTestApp();
const headers = await loginAsMentor(app);
const exam = seedExam(db);
const post = (url: string, payload?: object, h: Record<string, string> = headers) => app.inject({ method: 'POST', url, headers: h, payload });

const session = (await post('/api/admin/sessions', { examId: exam.id, autoApprove: true })).json<{ id: number }>();
await post(`/api/admin/sessions/${session.id}/open`);
const detail = (await app.inject({ url: `/api/admin/sessions/${session.id}`, headers })).json<{ roomCode: string }>();
await post(`/api/admin/sessions/${session.id}/start`);
const joined = (await post(`/api/sessions/${session.id}/join`, { displayName: 'Bench', roomCode: detail.roomCode }, {})).json<{ token: string }>();
const me = { 'x-participant-token': joined.token };
const started = await post('/api/me/attempts', undefined, me);
if (started.statusCode !== 201) throw new Error(`start attempt failed: ${started.statusCode} ${started.body}`);

for (let i = 0; i < 300; i++) await app.inject({ url: '/api/me', headers: me }); // warm-up
const t0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) {
  const res = await app.inject({ url: '/api/me', headers: me });
  if (res.statusCode !== 200) throw new Error(`unexpected ${res.statusCode}`);
}
const us = Number(process.hrtime.bigint() - t0) / 1000 / N;
console.log(`GET /api/me: ${us.toFixed(1)} µs/request over ${N} requests`);
await app.close();
