import type { SharedQuestion, SharedSessionItem } from '../../../../shared/api/index.js';

// Pure helpers of the share page (PRODUCT.md §7.33): grouping, dates and the class's choice counts.

const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "19/11" */
export const dayMonth = (ms: number) => { const d = new Date(ms); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
/** "14:00" */
export const clockOf = (ms: number) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
/** "Thứ Năm, 19/11/2026" */
export const longDate = (ms: number) => { const d = new Date(ms); return `${WEEKDAYS[d.getDay()]}, ${dayMonth(ms)}/${d.getFullYear()}`; };

export interface MonthGroup { key: string; label: string; items: SharedSessionItem[] }

/** Sessions grouped by the month they ran, keeping the server's order (newest first). No date: one group at the end. */
export function monthGroups(items: readonly SharedSessionItem[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  const byKey = new Map<string, MonthGroup>();
  for (const it of items) {
    const d = it.startedAt === null ? null : new Date(it.startedAt);
    const key = d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}` : 'none';
    let g = byKey.get(key);
    if (!g) {
      g = { key, label: d ? `Tháng ${d.getMonth() + 1}/${d.getFullYear()}` : 'Không rõ ngày thi', items: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.items.push(it);
  }
  const none = byKey.get('none');
  return none ? [...groups.filter(g => g !== none), none] : groups;
}

/** What a screen reader says for one row of the list. */
export const rowLabel = (it: SharedSessionItem) => `${it.examTitle}${it.startedAt === null ? '' : `, thi ${longDate(it.startedAt)} lúc ${clockOf(it.startedAt)}`}, ${it.questionCount} câu`;

export interface TallyRow { id: number; label: string; text: string; isCorrect: boolean; count: number; pct: number }
export interface Tally { rows: TallyRow[]; blank: { count: number; pct: number }; submitted: number; multi: boolean }

const pct = (n: number, of: number) => (of > 0 ? Math.round((n * 100) / of) : 0);
const letter = (i: number) => String.fromCharCode(65 + i);

/** Rows of the class's counts for one choice question, in option order; null when there is nothing to show. */
export function tallyOf(q: SharedQuestion, submitted: number): Tally | null {
  if (q.type === 'essay' || !q.distribution) return null;
  const d = q.distribution;
  const rows = [...q.options].sort((a, b) => a.position - b.position).map((o, i) => {
    const count = d.counts[o.id] ?? 0;
    return { id: o.id, label: letter(i), text: o.text, isCorrect: o.isCorrect, count, pct: pct(count, submitted) };
  });
  return { rows, blank: { count: d.blank, pct: pct(d.blank, submitted) }, submitted, multi: q.type === 'multi' };
}

export type LoadFailure = 'invalid' | 'unshared' | 'network';

/** Which screen a failed load shows: a wrong/replaced link, a session no longer shared, or a connection problem. */
export function failureOf(err: { status?: number; code?: string } | null | undefined): LoadFailure {
  if (err?.code === 'share_link_invalid') return 'invalid';
  if (err?.code === 'session_not_shared') return 'unshared';
  return 'network';
}

/** Path of the share page and of one session on it. `#cau-<n>` jumps to question n (1-based). */
export const listPath = (token: string) => `/shared/${encodeURIComponent(token)}`;
export const sessionPath = (token: string, id: number) => `${listPath(token)}/sessions/${id}`;
/** Question number from a `#cau-<n>` hash, 0-based; null when absent or out of range. */
export function questionFromHash(hash: string, count: number): number | null {
  const m = /^#cau-(\d+)$/.exec(hash);
  if (!m) return null;
  const n = Number(m[1]) - 1;
  return n >= 0 && n < count ? n : null;
}
