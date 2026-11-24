import { FLAG_CODES, FLAG_LABELS, type FlagCode } from '../../../shared/api/training.js';
import { maskSecrets } from './secrets.js';

/** One event the mentor marked. Only the light fields: the report never carries an output, a file change or an error text. */
export interface ReportExample {
  at: Date;
  kind: 'prompt' | 'tool' | 'permission' | 'session' | 'notice';
  prompt: string | null;
  toolName: string | null;
  toolTarget: string | null;
  ok: boolean | null;
  subtype: string | null;
}

export interface ReportMember {
  displayName: string;
  /** The member pressed "Dừng gửi" and the mentor has not approved deleting their data yet. */
  stoppedSending: boolean;
  promptCount: number;
  toolCount: number;
  failedCount: number;
  clearCount: number;
  compactCount: number;
  permissionCount: number;
  flags: FlagCode[];
  note: string | null;
  examples: ReportExample[];
}

export interface ReportInput {
  trainingName: string;
  exportedAt: Date;
  members: ReportMember[];
}

const PROMPT_CHARS = 600;
const TARGET_CHARS = 200;

const clip = (text: string, max: number): string => {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max).join('')}…`;
};

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** `dd/mm HH:MM`: a training can run for several days, so every time in the file carries its day. */
const stamp = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${clock(d)}`;
const stampLong = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${clock(d)}`;

/** Block-quote every line, so a multi-line prompt cannot break out of its list item. */
const quote = (text: string) => text.split(/\r?\n/).map(l => `> ${l}`.trimEnd()).join('\n');

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();
const code = (text: string) => `\`${oneLine(text).replaceAll('`', "'")}\``;

const SESSION_TITLE: Record<string, string> = {
  clear: 'Bắt đầu phiên Claude mới (/clear)',
  exit: 'Thoát Claude Code',
  compact_manual: 'Nén hội thoại (tự gõ /compact)',
  compact_auto: 'Nén hội thoại (Claude Code tự nén)',
  model_switch: 'Đổi model',
};

function exampleText(e: ReportExample): string {
  const time = stamp(e.at);
  if (e.kind === 'prompt') return `${time} · Prompt\n${quote(clip(e.prompt ?? '', PROMPT_CHARS))}`;
  if (e.kind === 'tool') {
    const result = e.ok === null ? '' : e.ok ? ' · chạy được' : ' · lỗi';
    return `${time} · ${e.toolName ?? 'Công cụ'} ${code(clip(e.toolTarget ?? '', TARGET_CHARS))}${result}`;
  }
  if (e.kind === 'permission') return `${time} · Claude xin quyền: ${e.toolName ?? 'công cụ'} ${code(clip(e.toolTarget ?? '', TARGET_CHARS))}`;
  if (e.kind === 'session') return `${time} · ${SESSION_TITLE[e.subtype ?? ''] ?? 'Sự kiện phiên'}`;
  return `${time} · Claude đang chờ`;
}

const flagList = (flags: FlagCode[]) => (flags.length === 0 ? 'không có cờ nào' : FLAG_CODES.filter(c => flags.includes(c)).map(c => FLAG_LABELS[c]).join(', '));

function memberSection(m: ReportMember): string {
  const lines = [
    `### ${oneLine(m.displayName)}${m.stoppedSending ? ' (đã dừng gửi)' : ''}`,
    '',
    `- Số liệu: ${m.promptCount} prompt · ${m.toolCount} lệnh (${m.failedCount} lỗi) · /clear ${m.clearCount} · nén ${m.compactCount} · xin quyền ${m.permissionCount}`,
    `- Cờ gợi ý: ${flagList(m.flags)}`,
  ];
  if (m.note) lines.push('', '**Ghi chú của mentor**', '', quote(m.note));
  if (m.examples.length > 0) {
    lines.push('', '**Ví dụ đã đánh dấu**', '');
    m.examples.forEach((e, i) => lines.push(`${i + 1}. ${exampleText(e).split('\n').join('\n   ')}`, ''));
  }
  return lines.join('\n').trimEnd();
}

function classSummary(members: ReportMember[]): string {
  const total = members.length;
  const rows = FLAG_CODES.map(c => ({ c, n: members.filter(m => m.flags.includes(c)).length })).filter(r => r.n > 0);
  if (rows.length === 0) return 'Chưa có cờ gợi ý nào.';
  return rows.map(r => `- ${r.n}/${total} bạn: ${FLAG_LABELS[r.c]}`).join('\n');
}

/**
 * The Markdown report the mentor downloads before "Kết thúc" (PRODUCT.md §7.35e): the class in numbers, then each member by name
 * with flags, figures, marked examples and the mentor's note. The whole text goes through `maskSecrets` last, so nothing that
 * looks like a key survives, whichever field it came in through.
 */
export function buildReport(input: ReportInput): string {
  const { members } = input;
  const parts = [
    `# Báo cáo buổi training: ${oneLine(input.trainingName)}`,
    '',
    `Xuất lúc ${stampLong(input.exportedAt)} · ${members.length} bạn`,
    '',
    '> Cờ là gợi ý để mentor xem lại, không phải đánh giá hay điểm số. File này không có output hay nội dung file; chuỗi giống khoá hoặc mật khẩu đã được che tự động (có thể sót).',
    '',
    '## Tổng hợp lớp',
    '',
    classSummary(members),
    '',
    '## Từng bạn',
    '',
    members.length === 0 ? 'Chưa có bạn nào trong buổi.' : members.map(memberSection).join('\n\n'),
    '',
  ];
  return maskSecrets(parts.join('\n'));
}
