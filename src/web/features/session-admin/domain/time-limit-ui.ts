import { MAX_TIME_LIMIT_MINUTES, MIN_TIME_LIMIT_MINUTES, parseTimeLimitMinutes } from '../../../../shared/session-timer.js';

/** What the mentor typed in the minutes box: a whole number in range, or why not. */
export function parseMinutes(raw: string): { minutes: number } | { error: string } {
  const minutes = parseTimeLimitMinutes(raw);
  return minutes === null ? { error: `Nhập số phút từ ${MIN_TIME_LIMIT_MINUTES} đến ${MAX_TIME_LIMIT_MINUTES}` } : { minutes };
}

/** The value to send: null = no limit; undefined = the box is invalid (the form shows why and blocks). */
export function chosenTimeLimit(limited: boolean, raw: string): number | null | undefined {
  if (!limited) return null;
  const parsed = parseMinutes(raw);
  return 'minutes' in parsed ? parsed.minutes : undefined;
}

/** Where the default came from, for the hint under the field (PRODUCT.md §7.27b). */
export function timeLimitHint(examDuration: number | null, limited: boolean, raw: string): string {
  if (!limited) return examDuration ? `Đề ghi ${examDuration} phút, bạn đã tắt giới hạn.` : 'Học viên làm tới khi bạn đóng phiên.';
  const parsed = parseMinutes(raw);
  if ('error' in parsed) return parsed.error;
  const fromExam = examDuration === parsed.minutes ? ' (theo file đề)' : '';
  return `Đồng hồ chung cho cả phòng, chạy từ lúc bạn bấm Bắt đầu${fromExam}. Hết giờ phiên tự đóng và nộp bài dở.`;
}

export const EXTEND_STEPS = [5, 10] as const;
