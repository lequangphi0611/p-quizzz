import { formatPoints } from '../format/points.js';

export type ScoreCheck = { ok: true; value: number } | { ok: false; message: string };

/** Parse what the mentor typed ("2,5" or "2.5") and check it against the question's points (steps of 0,5). */
export function parseScore(text: string, max: number): ScoreCheck {
  const t = text.trim().replace(',', '.');
  if (t === '') return { ok: false, message: 'Nhập điểm' };
  const n = Number(t);
  if (!Number.isFinite(n)) return { ok: false, message: 'Điểm không hợp lệ' };
  if (n < 0 || n > max) return { ok: false, message: `Điểm phải từ 0 đến ${formatPoints(max)}` };
  if ((n * 2) % 1 !== 0) return { ok: false, message: 'Điểm phải là bội số của 0,5' };
  return { ok: true, value: n };
}
