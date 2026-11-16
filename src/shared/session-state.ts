// Session lifecycle state machine — contract: docs/architecture.md §3. Pure, no Node/DOM APIs.

export type SessionStatus = 'draft' | 'lobby' | 'running' | 'closed' | 'finalized';
export type SessionAction = 'open' | 'start' | 'close' | 'finalize';

export const SESSION_ACTIONS: readonly SessionAction[] = ['open', 'start', 'close', 'finalize'];

// States in which members can join / work (at most one session may be in these at a time).
export const ACTIVE_STATUSES: readonly SessionStatus[] = ['lobby', 'running'];

const TRANSITIONS: Record<SessionStatus, Partial<Record<SessionAction, SessionStatus>>> = {
  draft: { open: 'lobby' },
  lobby: { start: 'running' },
  running: { close: 'closed' },
  closed: { finalize: 'finalized' },
  finalized: {},
};

/** The status after applying `action`, or null when the action is not valid from `current`. */
export function nextStatus(current: SessionStatus, action: SessionAction): SessionStatus | null {
  return TRANSITIONS[current][action] ?? null;
}

// Vietnamese labels for mentor-facing messages.
export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  draft: 'Nháp',
  lobby: 'Phòng chờ',
  running: 'Đang thi',
  closed: 'Đã đóng',
  finalized: 'Đã chốt',
};

export const SESSION_ACTION_VERB: Record<SessionAction, string> = {
  open: 'mở phòng chờ',
  start: 'bắt đầu thi',
  close: 'đóng phiên',
  finalize: 'chốt kết quả',
};
