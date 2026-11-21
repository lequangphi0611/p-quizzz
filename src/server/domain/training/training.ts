import type { TrainingConnection, TrainingStatus, UninstallCheckState } from '../../../shared/api/training.js';
import { displayNameKey } from '../../../shared/api/participants.js';
import { NameTakenError } from '../participant/errors.js';
import { TrainingCheckTooEarlyError, TrainingStateError } from './errors.js';

export type { TrainingStatus, TrainingConnection, UninstallCheckState };

export interface Training {
  id: number;
  name: string;
  status: TrainingStatus;
  /** 6 digits while `open`; null once stopped (the code stops working at once). */
  roomCode: string | null;
  createdAt: Date;
  stoppedAt: Date | null;
  endedAt: Date | null;
  /** Written only when the training ends (members are deleted then). */
  memberCount: number | null;
}

export interface TrainingMember {
  id: number;
  trainingId: number;
  displayName: string;
  /** The member's browser token. */
  token: string;
  /** Sits in the hook config on the member's machine: leaking it only lets someone send fake events. */
  ingestToken: string;
  consentedAt: Date;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  /** The member pressed "Dừng gửi" while the training was open: no new data is accepted from then on. */
  stoppedSendingAt: Date | null;
  seenAfterStopAt: Date | null;
  uninstallCheckAt: Date | null;
  uninstalledAt: Date | null;
}

const ACTIONS = { stop: ['open', 'stopped'], end: ['stopped', 'ended'] } as const;

const ORDER_MESSAGE: Record<'stop' | 'end', Partial<Record<TrainingStatus, string>>> = {
  stop: { stopped: 'Buổi training đã dừng thu rồi', ended: 'Buổi training đã kết thúc' },
  end: { open: 'Cần "Dừng thu" trước khi kết thúc buổi training', ended: 'Buổi training đã kết thúc' },
};

/** `open → stopped → ended`, never backwards and never skipping a step. */
export function nextTrainingStatus(status: TrainingStatus, action: 'stop' | 'end'): TrainingStatus {
  const [from, to] = ACTIONS[action];
  if (status !== from) throw new TrainingStateError(ORDER_MESSAGE[action][status] ?? 'Không thể đổi trạng thái buổi training');
  return to;
}

/** One name per person in a training, compared case-insensitively over all of Unicode (the index only knows ASCII). */
export function assertTrainingNameFree(others: { displayName: string }[], name: string): void {
  const key = displayNameKey(name);
  if (others.some(o => displayNameKey(o.displayName) === key)) throw new NameTakenError('identity_in_use');
}

type Seen = Pick<TrainingMember, 'seenAfterStopAt' | 'uninstalledAt'>;

/** The hook went quiet after the removal check passed: an event after `uninstalled_at` means it is still installed. */
const removalHolds = (m: Seen): m is Seen & { uninstalledAt: Date } =>
  m.uninstalledAt !== null && !(m.seenAfterStopAt !== null && m.seenAfterStopAt > m.uninstalledAt);

/**
 * What the mentor sees for one member. Only what the member's own machine proves: `waiting` until the first event
 * arrives, `connected` after, `uninstalled` once they passed the removal check and nothing came after it (PRODUCT.md §7.34e).
 */
export function connectionState(m: Pick<TrainingMember, 'firstSeenAt'> & Partial<Pick<TrainingMember, 'stoppedSendingAt'>> & Seen): TrainingConnection {
  if (removalHolds(m)) return 'uninstalled';
  if (m.stoppedSendingAt) return 'stopped_sending';
  return m.firstSeenAt ? 'connected' : 'waiting';
}

/**
 * Events after "Dừng thu", or after the member's own "Dừng gửi", mean the hook is still installed on that machine
 * (until a later passed check says otherwise).
 */
export const stillSending = (training: Pick<Training, 'status'>, m: Seen & Partial<Pick<TrainingMember, 'stoppedSendingAt'>>): boolean =>
  (training.status === 'stopped' || Boolean(m.stoppedSendingAt)) && m.seenAfterStopAt !== null && !removalHolds(m);

/** The member's "Dừng gửi" (only while open) and what the mentor may do about it (delete it), checked in one place. */
export function assertCanStopSending(training: Pick<Training, 'status'>): void {
  if (training.status === 'stopped') throw new TrainingStateError('Buổi training đã dừng thu, không cần dừng gửi nữa');
  if (training.status !== 'open') throw new TrainingStateError('Buổi training đã kết thúc');
}

export function assertCanPurge(training: Pick<Training, 'status'>, m: Pick<TrainingMember, 'stoppedSendingAt'>): void {
  if (training.status === 'ended') throw new TrainingStateError('Buổi training đã kết thúc');
  if (!m.stoppedSendingAt) throw new TrainingStateError('Chỉ xoá được dữ liệu của người đã dừng gửi');
}

/** The member's view of the removal check: `failed` is an event that arrived after the check began (or after it passed). */
export function uninstallCheckState(m: Pick<TrainingMember, 'uninstallCheckAt'> & Seen): UninstallCheckState {
  if (removalHolds(m)) return 'passed';
  if (m.seenAfterStopAt && ((m.uninstallCheckAt && m.seenAfterStopAt > m.uninstallCheckAt) || m.uninstalledAt)) return 'failed';
  return m.uninstallCheckAt ? 'waiting' : 'none';
}

/** The removal check needs a quiet moment to mean anything: asking for the verdict sooner than this is refused. */
export const UNINSTALL_CHECK_MIN_MS = 5000;

/**
 * Verdict of the removal check at `now`. Not started → state error; too soon → `too_early`; an event after it began → `failed`;
 * otherwise `passed`.
 */
export function uninstallCheckVerdict(m: Pick<TrainingMember, 'uninstallCheckAt' | 'seenAfterStopAt'>, now: Date): 'passed' | 'failed' {
  if (!m.uninstallCheckAt) throw new TrainingStateError('Chưa bắt đầu kiểm tra gỡ');
  if (now.getTime() - m.uninstallCheckAt.getTime() < UNINSTALL_CHECK_MIN_MS) throw new TrainingCheckTooEarlyError();
  return m.seenAfterStopAt && m.seenAfterStopAt > m.uninstallCheckAt ? 'failed' : 'passed';
}
