import type { EmailListParse } from '../../../shared/email-list.js';

export type PreviewFilter = 'need' | 'ok' | 'all';
export type PreviewRowKind = 'invalid' | 'duplicate' | 'added-domain' | 'ok';

export interface PreviewRow {
  key: string;
  line: number;
  raw: string;
  /** The full email a line becomes (for added-domain and duplicates). */
  email?: string;
  kind: PreviewRowKind;
  note: string;
}

/** Every line of the pasted list as a row, in line order. Things to look at carry a plain-words note (never colour alone). */
export function previewRows(p: EmailListParse): PreviewRow[] {
  const rows: PreviewRow[] = [
    ...p.valid.map<PreviewRow>(v => ({ key: `ok:${v.line}:${v.email}`, line: v.line, raw: v.raw, email: v.email, kind: v.addedDomain ? 'added-domain' : 'ok', note: v.addedDomain ? 'Đã thêm domain mặc định' : '' })),
    ...p.duplicates.map<PreviewRow>(d => ({ key: `dup:${d.line}:${d.email}`, line: d.line, raw: d.raw, email: d.email, kind: 'duplicate', note: `Trùng dòng ${d.firstLine}, gộp làm một` })),
    ...p.invalid.map<PreviewRow>(i => ({ key: `bad:${i.line}:${i.raw}`, line: i.line, raw: i.raw, kind: 'invalid', note: i.message })),
  ];
  return rows.sort((a, b) => a.line - b.line);
}

const needsLook = (r: PreviewRow) => r.kind !== 'ok';

export function filterRows(rows: readonly PreviewRow[], filter: PreviewFilter): PreviewRow[] {
  if (filter === 'need') return rows.filter(needsLook);
  if (filter === 'ok') return rows.filter(r => r.kind === 'ok' || r.kind === 'added-domain');
  return [...rows];
}

export interface PreviewCounts { valid: number; duplicates: number; invalid: number; addedDomain: number; need: number; all: number }

export function previewCounts(p: EmailListParse): PreviewCounts {
  const addedDomain = p.valid.filter(v => v.addedDomain).length;
  return { valid: p.valid.length, duplicates: p.duplicates.length, invalid: p.invalid.length, addedDomain, need: p.duplicates.length + p.invalid.length + addedDomain, all: p.valid.length + p.duplicates.length + p.invalid.length };
}

/** "Khi lưu: bỏ 1 dòng lỗi, gộp 2 dòng trùng." — what saving will do with the lines that are not clean, or '' when nothing. */
export function saveNote(p: EmailListParse): string {
  const parts = [p.invalid.length > 0 && `bỏ ${p.invalid.length} dòng lỗi`, p.duplicates.length > 0 && `gộp ${p.duplicates.length} dòng trùng`].filter(Boolean);
  return parts.length ? `Khi lưu: ${parts.join(', ')}.` : '';
}
