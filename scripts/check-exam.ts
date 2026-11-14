// Usage: npm run exam:check -- <file.md> [more.md ...]
// Validates exam Markdown files and prints errors/warnings with line numbers. Exit code 1 if any file has errors.
import { readFileSync } from 'node:fs';
import { parseExam } from '../src/shared/exam-format/index.js';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Cách dùng: npm run exam:check -- <file.md> [file2.md ...]');
  process.exit(2);
}

const TYPE_LABEL = { single: 'một đáp án', multi: 'nhiều đáp án', essay: 'tự luận' } as const;
let failed = false;

for (const file of files) {
  let source: string;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    console.error(`✗ ${file}: không đọc được file`);
    failed = true;
    continue;
  }
  const { exam, errors, warnings } = parseExam(source);
  for (const e of errors) console.log(`${file}:${e.line}  LỖI     ${e.message}`);
  for (const w of warnings) console.log(`${file}:${w.line}  CẢNH BÁO ${w.message}`);

  if (!exam) {
    failed = true;
    console.log(`✗ ${file}: ${errors.length} lỗi, ${warnings.length} cảnh báo — chưa import được.\n`);
    continue;
  }
  const counts = exam.questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.type] = (acc[q.type] ?? 0) + 1;
    return acc;
  }, {});
  const breakdown = (Object.keys(TYPE_LABEL) as (keyof typeof TYPE_LABEL)[])
    .filter((t) => counts[t])
    .map((t) => `${TYPE_LABEL[t]}: ${counts[t]}`)
    .join(', ');
  console.log(
    `✓ ${file}: "${exam.title}" — ${exam.questions.length} câu (${breakdown}), tổng ${exam.totalPoints} điểm, ` +
      `${exam.hasEssay ? 'có tự luận → mỗi member làm 1 lần' : 'thuần trắc nghiệm → cho làm lại'}` +
      `${warnings.length ? `, ${warnings.length} cảnh báo` : ''}.\n`,
  );
}

process.exit(failed ? 1 : 0);
