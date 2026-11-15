import type { SessionAction, SessionStatus } from '../../shared/session-state.js';

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
  closed: { action: 'finalize', label: 'Chốt kết quả', icon: 'flag', variant: 'primary' },
  finalized: null,
};

// Progress of one member while the exam runs. S11 will supply attempt data; until then everything is unknown.
export interface ProgressInfo { label: string; attempts: number | null }
export const UNKNOWN_PROGRESS: ProgressInfo = { label: '—', attempts: null };
