import type { TrainingConnection, TrainingStatus, UninstallCheckState } from '../../../shared/api/training.js';
import { displayNameKey } from '../../../shared/api/participants.js';
import { NameTakenError } from '../participant/errors.js';
import { TrainingStateError } from './errors.js';

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

/**
 * What the mentor sees for one member. Only what the member's own machine proves: `waiting` until the first event
 * arrives, `connected` after, `uninstalled` once they passed the removal check (PRODUCT.md §7.34e).
 */
export function connectionState(m: Pick<TrainingMember, 'firstSeenAt' | 'uninstalledAt'>): TrainingConnection {
  if (m.uninstalledAt) return 'uninstalled';
  return m.firstSeenAt ? 'connected' : 'waiting';
}

/** Events after "Dừng thu" mean the hook is still installed on that machine. */
export const stillSending = (training: Pick<Training, 'status'>, m: Pick<TrainingMember, 'seenAfterStopAt' | 'uninstalledAt'>): boolean =>
  training.status === 'stopped' && m.seenAfterStopAt !== null && m.uninstalledAt === null;

/** The member's view of the removal check. (`failed` comes with the check itself.) */
export function uninstallCheckState(m: Pick<TrainingMember, 'uninstallCheckAt' | 'uninstalledAt'>): UninstallCheckState {
  if (m.uninstalledAt) return 'passed';
  return m.uninstallCheckAt ? 'waiting' : 'none';
}
