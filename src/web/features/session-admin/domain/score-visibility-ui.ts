import type { ScoreVisibility, SessionDetail } from '../../../../shared/api/index.js';

/** The two choices the mentor makes per session (PRODUCT.md §7.25). Default: show on submit, as before. */
export const SCORE_VISIBILITY_CHOICES: { value: ScoreVisibility; label: string; hint: string }[] = [
  { value: 'on_submit', label: 'Hiện ngay khi nộp', hint: 'Học viên nộp xong thấy ngay điểm và bảng xếp hạng.' },
  { value: 'on_release', label: 'Giữ tới khi công bố', hint: 'Học viên và màn chiếu chỉ thấy ai đã nộp. Điểm hiện khi bạn bấm “Công bố điểm” hoặc khi đóng phiên.' },
];

export interface ScoreVisibilityState {
  /** The switch can still move: open session, nothing published, nobody has submitted. */
  canChange: boolean;
  /** Why it cannot, when it cannot (shown under the read-only value). */
  lockedReason: string | null;
  /** "Công bố điểm" is offered. */
  canRelease: boolean;
  /** How many people have handed in (kicked ones included: they may have seen a score). */
  submitted: number;
}

type Detail = Pick<SessionDetail, 'status' | 'scoreVisibility' | 'scoresReleasedAt' | 'scoresHidden' | 'participants'>;

/** Mirrors the server's rule (domain/session/score-visibility.ts) so the page offers only what will be accepted. */
export function scoreVisibilityState(d: Detail): ScoreVisibilityState {
  const submitted = d.participants.filter(p => p.progress.submittedAt !== null).length;
  const ended = d.status === 'closed' || d.status === 'finalized';
  let lockedReason: string | null = null;
  if (ended) lockedReason = 'Phiên đã kết thúc: học viên đã thấy điểm.';
  else if (d.scoresReleasedAt !== null) lockedReason = 'Đã công bố điểm, không ẩn lại được.';
  else if (submitted > 0) lockedReason = 'Đã có người nộp bài nên không đổi được nữa (để mọi người được đối xử như nhau).';
  return { canChange: lockedReason === null, lockedReason, canRelease: d.scoresHidden, submitted };
}
