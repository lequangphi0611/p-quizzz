import { TEACHING_LABEL_TEXT, TEACHING_LABELS, TEACHING_TOPIC_TEXT, TEACHING_TOPICS, type TeachingLabel, type TeachingTopic } from '../../../shared/api/training.js';
import { turnOf } from './export-selection.js';
import { maskHomePaths } from './mask-paths.js';
import { maskSecrets } from './secrets.js';

// Teaching examples (PRODUCT.md §7.39): prompts the mentor picked to teach the next course. The file built here carries no member
// name, no date or time, no session number, no output and no file change: only the prompt, the commands of its turn, and the mentor's words.

/** What the context of a turn needs from an event. */
export interface ContextEvent {
  id: number;
  kind: 'prompt' | 'tool' | 'permission' | 'session' | 'notice';
  claudeSessionId: string;
  toolName: string | null;
  toolTarget: string | null;
  ok: boolean | null;
}

/** The prompt as the file would carry it before the mentor edits it: secrets and home folders masked. */
export const maskForExample = (text: string): string => maskHomePaths(maskSecrets(text));

const TARGET_CHARS = 120;

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();
const clip = (text: string, max: number) => {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max).join('')}…`;
};

/**
 * The default context of a prompt: one line per command of its turn, `✓|✗ <tool> <target>`, in the order they ran. Never an output, an
 * error or a file change. Masked, because the mentor reviews it (and may edit it) before it goes anywhere.
 */
export function buildTurnContext(events: readonly ContextEvent[], promptId: number): string {
  const lines = turnOf(events, promptId)
    .filter(e => e.kind === 'tool')
    .map(e => `${e.ok === true ? '✓' : '✗'} ${oneLine(e.toolName ?? 'Công cụ')}${e.toolTarget ? ` ${clip(oneLine(e.toolTarget), TARGET_CHARS)}` : ''}`);
  return maskHomePaths(maskSecrets(lines.join('\n')));
}

/** One example ready for the file: the texts are the ones to print (the mentor's edit when there is one, else the masked original). */
export interface TeachingFileExample {
  eventId: number;
  label: TeachingLabel;
  topic: TeachingTopic;
  prompt: string;
  context: string;
  comment: string;
  betterPrompt: string | null;
}

/** A fixed scramble of the id: the same ids always give the same order, and the order follows neither the member nor the time. */
const scramble = (id: number) => Math.imul(id ^ 0x9e3779b9, 0x85ebca6b) >>> 0;

/** Topic, then label (good first), then a stable shuffle by event id. */
export function orderExamples<T extends { eventId: number; label: TeachingLabel; topic: TeachingTopic }>(examples: readonly T[]): T[] {
  return [...examples].sort(
    (a, b) =>
      TEACHING_TOPICS.indexOf(a.topic) - TEACHING_TOPICS.indexOf(b.topic) ||
      TEACHING_LABELS.indexOf(a.label) - TEACHING_LABELS.indexOf(b.label) ||
      scramble(a.eventId) - scramble(b.eventId) ||
      a.eventId - b.eventId,
  );
}

/** Block-quote every line, so a multi-line prompt cannot break out of its section. */
const quote = (text: string) => text.split(/\r?\n/).map(l => `> ${l}`.trimEnd()).join('\n');

/** A code fence longer than any run of backticks inside, so the text cannot close it early. */
const fence = (text: string) => {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map(r => r.length));
  const ticks = '`'.repeat(Math.max(3, longest + 1));
  return `${ticks}\n${text}\n${ticks}`;
};

function exampleSection(e: TeachingFileExample, n: number): string {
  const parts = [`#### Ví dụ ${n} · ${TEACHING_LABEL_TEXT[e.label]}`, '', '**Prompt**', '', quote(e.prompt.trim() === '' ? '(trống)' : e.prompt), '', '**Bối cảnh: các lệnh Claude chạy trong lượt này**', ''];
  parts.push(e.context.trim() === '' ? '(Không có lệnh nào trong lượt này)' : fence(e.context));
  parts.push('', '**Nhận xét**', '', quote(e.comment));
  if (e.betterPrompt && e.betterPrompt.trim() !== '') parts.push('', '**Phiên bản tốt hơn**', '', quote(e.betterPrompt));
  return parts.join('\n');
}

const INTRO =
  'Đây là các ví dụ prompt thật đã bỏ tên người viết, dùng để dạy khoá sau. Nhãn "Tốt" hoặc "Chưa tốt" nói về cách viết prompt trong tình huống đó, không nói về người viết. ' +
  'Bối cảnh chỉ là danh sách lệnh Claude đã chạy (✓ chạy được, ✗ lỗi), không có kết quả hay nội dung file. ' +
  'Chuỗi giống khoá hoặc mật khẩu đã được che tự động (có thể sót).';

/**
 * The Markdown file of the examples: by topic, then label, then a stable shuffle by event id. The name of the training is the only
 * title. The whole text goes through `maskSecrets` last, whichever field a secret came in through (PRODUCT.md §7.39d).
 */
export function buildTeachingExamplesFile(trainingName: string, examples: readonly TeachingFileExample[]): string {
  const ordered = orderExamples(examples);
  const parts = [`# Ví dụ prompt để dạy: ${oneLine(trainingName)}`, '', `> ${INTRO}`, ''];
  let n = 0;
  for (const topic of TEACHING_TOPICS) {
    const inTopic = ordered.filter(e => e.topic === topic);
    if (inTopic.length === 0) continue;
    parts.push(`## Chủ đề: ${TEACHING_TOPIC_TEXT[topic]}`, '');
    for (const label of TEACHING_LABELS) {
      const group = inTopic.filter(e => e.label === label);
      if (group.length === 0) continue;
      parts.push(`### ${TEACHING_LABEL_TEXT[label]}`, '');
      for (const e of group) parts.push(exampleSection(e, ++n), '');
    }
  }
  return maskHomePaths(maskSecrets(parts.join('\n')));
}
