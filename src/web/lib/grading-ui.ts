import type { GradingAnswer } from '../../shared/api/index.js';

export const isBlank = (a: Pick<GradingAnswer, 'textAnswer'>): boolean => !a.textAnswer || a.textAnswer.trim() === '';

export type ScoreCheck = { ok: true; value: number } | { ok: false; message: string };

/** Parse what the mentor typed ("2,5" or "2.5") and check it against the question's points. */
export function parseScore(text: string, max: number): ScoreCheck {
  const t = text.trim().replace(',', '.');
  if (t === '') return { ok: false, message: 'Nhập điểm' };
  const n = Number(t);
  if (!Number.isFinite(n)) return { ok: false, message: 'Điểm không hợp lệ' };
  if (n < 0 || n > max) return { ok: false, message: `Điểm phải từ 0 đến ${String(max).replace('.', ',')}` };
  if ((n * 2) % 1 !== 0) return { ok: false, message: 'Điểm phải là bội số của 0,5' };
  return { ok: true, value: n };
}

export const formatScore = (n: number): string => String(n).replace('.', ',');

/** Display name, or "Bài #k" (k = 1-based position) while blind grading hides names. */
export const answerLabel = (a: Pick<GradingAnswer, 'displayName'>, index: number, blind: boolean): string => (blind ? `Bài #${index + 1}` : a.displayName);
