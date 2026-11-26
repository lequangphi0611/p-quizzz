#!/usr/bin/env node
// Stand-in for the Claude CLI in tests and e2e (never calls an AI). Configure it like the mentor would:
//   { "command": "<node>", "args": ["<this file>", "--fake-mode", "ok", "--fake-record", "<file.json>"] }
// Modes: ok (default) · slow (sleeps --fake-delay ms, default 800, then ok) · hang (sleeps forever) · garbage · fail (exit 2).
// "ok" scores by keywords so the e2e has varied suggestions, and flags lines that talk to the grader.
// A prompt holding <mentor_examples> (S45, example drafts) gets a draft instead: needs_work for a short prompt, good for a long one,
// suspicious (with the exact words as the quote) when the prompt talks to the reviewer.
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

  if (stdin.includes('<mentor_examples>')) return void process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: '', structured_output: fakeDraft(stdin), modelUsage: { 'fake-model': {} } }));

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

// What a draft of S45 looks like, from the prompt in `<prompt>…</prompt>` (the last one: the examples come first in stdin).
function fakeDraft(text) {
  const prompts = [...text.matchAll(/<prompt>([\s\S]*?)<\/prompt>/g)];
  const prompt = prompts.at(-1)?.[1] ?? '';
  const samples = (text.match(/<example>/g) ?? []).length;
  const words = prompt.trim().split(/\s+/).filter(Boolean).length;
  const aimed = prompt.split('\n').find(l => /người đánh giá|người chấm|reviewer|nhãn tốt|label it good/i.test(l));
  const good = words >= 12 && !aimed;
  return {
    label: good ? 'good' : 'needs_work',
    topic: good ? 'delegation' : 'verify',
    comment: good ? `Prompt nêu rõ việc cần làm (nháp dựa trên ${samples} ví dụ).` : `Prompt chưa nói cách kiểm tra kết quả (nháp dựa trên ${samples} ví dụ).`,
    betterPrompt: good ? '' : `${prompt.trim()} Chạy <lệnh chạy test> và báo kết quả.`,
    suspicious: Boolean(aimed),
    suspiciousReason: aimed ? 'Prompt có câu nhắm vào người đánh giá.' : '',
    suspiciousQuote: aimed ? aimed.trim().slice(0, 200) : '',
  };
}
