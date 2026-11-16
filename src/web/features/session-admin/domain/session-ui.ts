import type { ParticipantProgress } from '../../../../shared/api/index.js';
import type { SessionAction, SessionStatus } from '../../../../shared/session-state.js';

export interface ActionSpec {
  action: SessionAction;
  label: string;
  icon: string;
  variant: 'primary' | 'danger';
  /** Present when the mentor must confirm first (start and close, per S09). */
  confirm?: { title: string; body: (activeCount: number) => string; confirmLabel: string };
}

// The one valid next action per status. Statuses with no entry have nothing left to do.
export const ACTION_FOR_STATUS: Record<SessionStatus, ActionSpec | null> = {
  draft: { action: 'open', label: 'Mở phòng chờ', icon: 'door-open', variant: 'primary' },
  lobby: {
    action: 'start', label: 'Bắt đầu', icon: 'play', variant: 'primary',
    confirm: { title: 'Bắt đầu phiên thi?', confirmLabel: 'Bắt đầu', body: n => `${n} người đang trong phòng chờ. Member sẽ thấy màn hình làm bài ngay.` },
  },
  running: {
    action: 'close', label: 'Đóng phiên', icon: 'door-open', variant: 'danger',
    confirm: { title: 'Đóng phiên thi?', confirmLabel: 'Đóng phiên', body: () => 'Bài đang làm dở sẽ được tự nộp với câu trả lời đã lưu.' },
  },
  closed: {
    action: 'finalize', label: 'Chốt kết quả', icon: 'flag', variant: 'primary',
    confirm: { title: 'Chốt kết quả?', confirmLabel: 'Chốt kết quả', body: () => 'Điểm sẽ thành chính thức, bảng xếp hạng bỏ nhãn "Tạm tính" và không sửa điểm được nữa.' },
  },
  finalized: null,
};

// How the mentor's progress column reads, per member (data comes from GET /api/admin/sessions/:id).
export const PROGRESS_LABEL: Record<ParticipantProgress['state'], { label: string; color: string }> = {
  none: { label: 'Chưa bắt đầu', color: 'var(--text-faint)' },
  doing: { label: 'Đang làm', color: 'var(--brand-700)' },
  submitted: { label: 'Đã nộp', color: 'var(--correct-600)' },
};

/** Progress column text. A submitted member's edit request (PRODUCT.md §7.21) refines "Đã nộp". */
export function progressLabelOf(p: ParticipantProgress): { label: string; color: string; icon?: string } {
  const edit = p.state === 'submitted' ? p.editRequest?.status : undefined;
  if (edit === 'pending') return { label: 'Đã nộp · xin sửa', color: 'var(--sun-ink)', icon: 'hourglass' };
  if (edit === 'approved') return { label: 'Đang sửa tự luận', color: 'var(--brand-700)' };
  if (edit === 'done') return { label: 'Đã sửa tự luận', color: 'var(--correct-600)' };
  return PROGRESS_LABEL[p.state];
}

/** "7,5/9" — comma decimals like the rest of the UI; "—" while nothing is submitted. */
export function formatProgressScore(p: ParticipantProgress): string {
  if (p.countedScore === null) return '—';
  return `${String(p.countedScore).replace('.', ',')}/${p.maxScore}`;
}
