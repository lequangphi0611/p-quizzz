import type { ExamIssue, ParsedExam, ParsedOption, ParsedQuestion, ParseResult } from './types.js';

// Parser + validator for the exam Markdown format (docs/exam-format.md).
// Line-based on purpose: every error must point to a line the mentor can find in the reviewed file.
// Pure function, no Node/DOM APIs — used by the CLI, the server import endpoint and the web preview.

const KNOWN_META = new Set(['essay', 'points']);
const KNOWN_FRONTMATTER = new Set(['title', 'description', 'duration']);
/** Allowed `duration` (minutes) in the frontmatter (PRODUCT.md §7.27). */
export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 300;

/**
 * The one rule for a time limit in minutes, wherever it comes from (exam frontmatter, the mentor's form, the API):
 * a whole number from MIN_DURATION_MINUTES to MAX_DURATION_MINUTES.
 */
export const isDurationMinutes = (n: number): boolean => Number.isInteger(n) && n >= MIN_DURATION_MINUTES && n <= MAX_DURATION_MINUTES;

/** Typed text (digits only, surrounding spaces ignored) to minutes, or null when it breaks the rule above. */
export function parseDurationMinutes(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return isDurationMinutes(n) ? n : null;
}
const MAX_POINTS = 100;

const RE_QUESTION = /^##\s+(.*)$/;
const RE_OTHER_HEADING = /^(#|#{3,6})\s/;
const RE_OPTION = /^\s*[-*]\s+\[([ xX])\]\s*(.*)$/;
const RE_QUOTE = /^\s*>\s?(.*)$/;
const RE_FENCE = /^\s*(`{3,}|~{3,})/;
const RE_META = /\s*\{([^{}]*)\}\s*$/;
const RE_META_CONTENT = /^\s*[a-z]+(\s*=\s*[^,\s]+)?(\s*,\s*[a-z]+(\s*=\s*[^,\s]+)?)*\s*$/i;
const RE_LETTER_OPTION = /^\s*[A-Da-d][.)]\s+\S/;
// Options whose meaning depends on other options or their position break when options are shuffled.
// `\b` treats accented letters as non-word characters ("cục và cấu" would match "c và c"),
// so word boundaries are Unicode-aware lookarounds instead.
const RE_POSITIONAL =
  /(tất cả (các )?(đáp án|phương án|ý|câu) (trên|đều)|cả (hai|ba|bốn) (đáp án|ý|phương án)|không (có )?(đáp án|phương án|ý) nào|all of the above|none of the above|(?<![\p{L}\p{N}_])both [a-d] and [a-d](?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(đáp án|phương án|ý) [a-d](?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])[a-d] (và|hoặc|and|or) [a-d](?![\p{L}\p{N}_]))/iu;

type Phase = 'body' | 'options' | 'explanation';

interface Draft {
  line: number;
  prompt: string;
  meta: Map<string, string | true>;
  bodyLines: string[];
  options: (ParsedOption & { line: number })[];
  explanationLines: string[];
  phase: Phase;
  blankAfterExplanation: boolean;
}

export function parseExam(source: string): ParseResult {
  const errors: ExamIssue[] = [];
  const warnings: ExamIssue[] = [];
  const err = (line: number, message: string) => errors.push({ line, message });
  const warn = (line: number, message: string) => warnings.push({ line, message });

  const lines = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');

  // --- Frontmatter ---
  const front = new Map<string, string>();
  const frontLine = new Map<string, number>();
  let i = 0;
  if (lines[0]?.trim() !== '---') {
    err(1, 'Thiếu frontmatter. File phải bắt đầu bằng dòng `---`, sau đó `title: ...`, rồi `---`.');
  } else {
    const end = lines.findIndex((l, idx) => idx > 0 && l.trim() === '---');
    if (end === -1) {
      err(1, 'Frontmatter chưa được đóng bằng dòng `---`.');
      i = lines.length;
    } else {
      for (let k = 1; k < end; k++) {
        const raw = lines[k] ?? '';
        if (!raw.trim()) continue;
        const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(raw);
        if (!m) {
          err(k + 1, `Dòng frontmatter không hợp lệ: "${raw.trim()}". Dạng đúng: \`key: value\`.`);
          continue;
        }
        const key = m[1]!.toLowerCase();
        const value = m[2]!.trim().replace(/^(["'])(.*)\1$/, '$2');
        if (!KNOWN_FRONTMATTER.has(key)) warn(k + 1, `Frontmatter có key không dùng tới: "${key}" (bị bỏ qua).`);
        front.set(key, value);
        frontLine.set(key, k + 1);
      }
      i = end + 1;
    }
  }
  const title = front.get('title')?.trim() ?? '';
  if (lines[0]?.trim() === '---' && !title) err(1, 'Frontmatter thiếu `title`.');

  // Blank or missing = no time limit. Anything else must be a whole number of minutes in range.
  const durationRaw = front.get('duration')?.trim() ?? '';
  let durationMinutes: number | null = null;
  if (durationRaw) {
    durationMinutes = parseDurationMinutes(durationRaw);
    if (durationMinutes === null)
      err(
        frontLine.get('duration') ?? 1,
        `\`duration\` phải là số phút nguyên từ ${MIN_DURATION_MINUTES} đến ${MAX_DURATION_MINUTES} (ví dụ \`duration: 30\`), hoặc bỏ trống nếu không giới hạn thời gian. Đang là: "${durationRaw}".`,
      );
  }

  // --- Questions ---
  const questions: ParsedQuestion[] = [];
  const seen = new Map<string, number>();
  let q: Draft | null = null;
  let fence: { marker: string; line: number } | null = null;

  const finalize = (d: Draft) => {
    const result = finalizeQuestion(d, err, warn);
    if (!result) return;
    const key = normalize(`${result.prompt}\n${result.body}`);
    const dup = seen.get(key);
    if (dup !== undefined) err(d.line, `Câu hỏi trùng với câu ở dòng ${dup}.`);
    else seen.set(key, d.line);
    questions.push(result);
  };

  for (; i < lines.length; i++) {
    const raw = lines[i]!;
    const ln = i + 1;

    if (fence) {
      q?.bodyLines.push(raw);
      const close = RE_FENCE.exec(raw);
      if (close && raw.trim() === close[1] && close[1]![0] === fence.marker[0] && close[1]!.length >= fence.marker.length) {
        fence = null;
      }
      continue;
    }

    const fenceOpen = RE_FENCE.exec(raw);
    if (fenceOpen) {
      fence = { marker: fenceOpen[1]!, line: ln };
      if (!q) err(ln, 'Có nội dung nằm ngoài câu hỏi. Mọi nội dung phải nằm dưới một tiêu đề `## `.');
      else if (q.phase !== 'body') err(ln, 'Code block phải nằm trong phần nội dung câu hỏi, trước danh sách đáp án.');
      else q.bodyLines.push(raw);
      continue;
    }

    const heading = RE_QUESTION.exec(raw);
    if (heading) {
      if (q) finalize(q);
      q = startQuestion(heading[1]!, ln, err);
      continue;
    }

    if (RE_OTHER_HEADING.test(raw)) {
      err(ln, 'Chỉ dùng `## ` cho tiêu đề câu hỏi. Không dùng `#`, `###`... trong file đề.');
      continue;
    }

    if (!raw.trim()) {
      if (q?.phase === 'body') q.bodyLines.push('');
      if (q?.phase === 'explanation') q.blankAfterExplanation = true;
      continue;
    }

    if (!q) {
      err(ln, 'Có nội dung nằm ngoài câu hỏi. Mọi nội dung phải nằm dưới một tiêu đề `## `.');
      continue;
    }

    const opt = RE_OPTION.exec(raw);
    if (opt) {
      if (q.phase === 'explanation') {
        err(ln, 'Đáp án nằm sau phần giải thích (`>`). Giải thích phải ở cuối câu hỏi.');
        continue;
      }
      q.phase = 'options';
      const text = opt[2]!.trim();
      if (!text) err(ln, 'Đáp án bị trống.');
      q.options.push({ text, correct: opt[1] !== ' ', line: ln });
      continue;
    }

    const quote = RE_QUOTE.exec(raw);
    if (quote) {
      if (q.phase === 'explanation' && q.blankAfterExplanation) {
        // Blank line inside the explanation = paragraph break.
        q.explanationLines.push('');
        q.blankAfterExplanation = false;
      }
      q.phase = 'explanation';
      q.explanationLines.push(quote[1]!);
      continue;
    }

    if (q.phase === 'options') {
      err(ln, 'Dòng này không phải đáp án nhưng nằm trong/sau danh sách đáp án. Mỗi đáp án chỉ được 1 dòng `- [ ]` hoặc `- [x]`; code dài hãy đặt ở phần nội dung câu hỏi.');
    } else if (q.phase === 'explanation') {
      err(ln, 'Sau phần giải thích (`>`) không được có nội dung khác. Mỗi dòng giải thích phải bắt đầu bằng `>`.');
    } else {
      q.bodyLines.push(raw);
    }
  }

  if (fence) err(fence.line, 'Code block chưa được đóng.');
  if (q) finalize(q);
  if (questions.length === 0 && errors.length === 0) err(1, 'Đề chưa có câu hỏi nào (mỗi câu bắt đầu bằng `## `).');

  // The app runs offline on a LAN: an image from the internet will not load, and loading it would leak members' IPs.
  lines.forEach((text, idx) => {
    if (/!\[[^\]]*\]\(\s*(?:https?:)?\/\/[^)]*\)/i.test(text)) warn(idx + 1, 'Ảnh trỏ tới địa chỉ bên ngoài sẽ bị chặn (app chạy offline trong LAN). Hãy bỏ ảnh hoặc mô tả bằng chữ.');
  });

  errors.sort((a, b) => a.line - b.line);
  warnings.sort((a, b) => a.line - b.line);

  const exam: ParsedExam | null =
    errors.length > 0
      ? null
      : {
          title,
          description: front.get('description')?.trim() || null,
          durationMinutes,
          questions,
          totalPoints: questions.reduce((s, x) => s + x.points, 0),
          hasEssay: questions.some((x) => x.type === 'essay'),
        };

  return { exam, errors, warnings };
}

function startQuestion(headingText: string, line: number, err: (l: number, m: string) => void): Draft {
  let prompt = headingText.trim();
  const meta = new Map<string, string | true>();
  const m = RE_META.exec(prompt);
  if (m && RE_META_CONTENT.test(m[1]!)) {
    prompt = prompt.slice(0, m.index).trim();
    for (const part of m[1]!.split(',')) {
      const [k, v] = part.split('=').map((s) => s.trim());
      const key = k!.toLowerCase();
      if (!KNOWN_META.has(key)) {
        err(line, `Thuộc tính không hợp lệ: "${key}". Chỉ hỗ trợ \`essay\` và \`points=N\`. Nếu {…} là nội dung câu hỏi, hãy bọc trong \`code\`.`);
        continue;
      }
      if (meta.has(key)) err(line, `Thuộc tính "${key}" bị khai báo 2 lần.`);
      meta.set(key, v ?? true);
    }
  }
  if (!prompt) err(line, 'Tiêu đề câu hỏi bị trống.');
  return { line, prompt, meta, bodyLines: [], options: [], explanationLines: [], phase: 'body', blankAfterExplanation: false };
}

function finalizeQuestion(
  d: Draft,
  err: (l: number, m: string) => void,
  warn: (l: number, m: string) => void,
): ParsedQuestion | null {
  let ok = Boolean(d.prompt);

  // points
  let points = 1;
  const rawPoints = d.meta.get('points');
  if (rawPoints !== undefined) {
    const n = rawPoints === true ? NaN : Number(rawPoints);
    if (!Number.isInteger(n) || n < 1 || n > MAX_POINTS) {
      err(d.line, `points phải là số nguyên từ 1 đến ${MAX_POINTS}.`);
      ok = false;
    } else points = n;
  }
  const essayFlag = d.meta.get('essay');
  if (typeof essayFlag === 'string') {
    err(d.line, '`essay` không nhận giá trị, chỉ ghi `{essay}`.');
    ok = false;
  }

  const body = trimBlankLines(d.bodyLines).join('\n');
  const explanation = d.explanationLines.length ? d.explanationLines.join('\n').trim() || null : null;
  const options = d.options.map(({ text, correct }) => ({ text, correct }));
  const correctCount = options.filter((o) => o.correct).length;

  let type: ParsedQuestion['type'];
  if (essayFlag !== undefined) {
    type = 'essay';
    if (options.length > 0) {
      err(d.line, 'Câu tự luận (`{essay}`) không được có đáp án `- [ ]`.');
      ok = false;
    }
    if (!explanation) warn(d.line, 'Câu tự luận nên có đáp án mẫu / rubric (dòng `>`) để mentor chấm nhất quán.');
  } else {
    if (options.length === 0) {
      const hint = d.bodyLines.some((l) => RE_LETTER_OPTION.test(l))
        ? ' Có vẻ đáp án đang viết dạng "A. …" — hãy đổi sang `- [ ]` / `- [x]`.'
        : ' Nếu là câu tự luận, thêm `{essay}` vào cuối tiêu đề.';
      err(d.line, `Câu hỏi không có đáp án.${hint}`);
      return null;
    }
    if (options.length < 2) {
      err(d.line, 'Câu trắc nghiệm cần ít nhất 2 đáp án.');
      ok = false;
    }
    if (correctCount === 0) {
      err(d.line, 'Câu trắc nghiệm chưa đánh dấu đáp án đúng (`- [x]`).');
      ok = false;
    }
    if (correctCount > 0 && correctCount === options.length && options.length >= 2) {
      warn(d.line, 'Tất cả đáp án đều đúng — kiểm tra lại có phải cố ý không.');
    }
    const texts = new Map<string, number>();
    for (const o of d.options) {
      const k = normalize(o.text);
      if (texts.has(k)) {
        err(o.line, `Đáp án trùng với đáp án ở dòng ${texts.get(k)}.`);
        ok = false;
      } else texts.set(k, o.line);
      if (RE_POSITIONAL.test(o.text)) {
        warn(o.line, 'Đáp án tham chiếu đến đáp án khác hoặc vị trí ("tất cả các đáp án trên", "A và B"...) sẽ sai nghĩa vì thứ tự đáp án được trộn.');
      }
    }
    if (!explanation) warn(d.line, 'Nên có giải thích (dòng `>`) để member hiểu vì sao đúng/sai khi xem lại.');
    type = correctCount >= 2 ? 'multi' : 'single';
  }

  if (!ok) return null;
  return { type, prompt: d.prompt, body, options, points, explanation, line: d.line };
}

function trimBlankLines(lines: string[]): string[] {
  let s = 0;
  let e = lines.length;
  while (s < e && !lines[s]!.trim()) s++;
  while (e > s && !lines[e - 1]!.trim()) e--;
  return lines.slice(s, e);
}

function normalize(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}
