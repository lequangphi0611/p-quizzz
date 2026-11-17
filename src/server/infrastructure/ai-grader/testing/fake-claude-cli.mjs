#!/usr/bin/env node
// Stand-in for the Claude CLI in tests and e2e (never calls an AI). Configure it like the mentor would:
//   { "command": "<node>", "args": ["<this file>", "--fake-mode", "ok", "--fake-record", "<file.json>"] }
// Modes: ok (default) · slow (sleeps --fake-delay ms, default 800, then ok) · hang (sleeps forever) · garbage · fail (exit 2).
// "ok" scores by keywords so the e2e has varied suggestions, and flags lines that talk to the grader.
import { appendFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const mode = opt('--fake-mode', 'ok');

let stdin = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => (stdin += c));
process.stdin.on('end', async () => {
  const record = opt('--fake-record');
  if (record) appendFileSync(record, JSON.stringify({ argv, stdin, cwd: process.cwd() }) + '\n');

  if (mode === 'fail') process.exit(2);
  if (mode === 'garbage') return void process.stdout.write('not json at all');
  if (mode === 'hang') return void setTimeout(() => {}, 1e9);
  if (mode === 'slow') await new Promise(r => setTimeout(r, Number(opt('--fake-delay', '800'))));

  const points = Number(/<question points="([\d.]+)">/.exec(stdin)?.[1] ?? 1);
  const criteria = [...stdin.matchAll(/^T(\d+) \(([\d.]+) điểm\): (.*)$/gm)].map(m => ({ n: Number(m[1]), max: Number(m[2]), text: m[3] }));
  const answer = /<student_answer>\n([\s\S]*?)\n<\/student_answer>/.exec(stdin)?.[1] ?? '';
  const lines = answer.split('\n').map(l => l.replace(/^\d+\| /, ''));
  const words = lines.join(' ').trim().split(/\s+/).filter(Boolean).length;
  const flagged = lines.flatMap((l, i) => (/người chấm|điểm tối đa|grader/i.test(l) ? [i + 1] : []));
  const ratio = flagged.length ? 0.2 : words >= 40 ? 1 : words >= 15 ? 0.6 : 0.3;
  const half = n => Math.floor(n * 2) / 2;
  const items = (criteria.length ? criteria : [{ n: 1, max: points, text: 'Tổng' }]).map(c => ({ label: `T${c.n}`, max: c.max, score: half(c.max * ratio), note: ratio === 1 ? 'Đủ ý.' : 'Còn thiếu ý so với rubric.' }));
  const score = items.reduce((t, c) => t + c.score, 0);
  const out = {
    score,
    feedback: ratio === 1 ? 'Bài trả lời đủ các ý chính.' : 'Bài còn thiếu ý, xem lại rubric.',
    criteria: items,
    suspicious: flagged.length > 0,
    suspiciousReason: flagged.length ? `Bài có câu yêu cầu người chấm cho điểm (dòng ${flagged.join(', ')}). Đã bỏ qua khi chấm.` : '',
    suspiciousLines: flagged,
  };
  process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: '', structured_output: out, modelUsage: { 'fake-model': {} } }));
});
