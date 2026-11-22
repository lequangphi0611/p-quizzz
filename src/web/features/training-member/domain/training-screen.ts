import type { MyTraining } from '../../../../shared/api/index.js';

/**
 * What the member sees at `/training/:id`.
 *  - `consent`: no token yet; name + what is sent + agree (screen 1)
 *  - `install`: joined, nothing received yet; folder, config, waiting (screens 2-4)
 *  - `recording`: "Đã nhận tín hiệu" (screen 5)
 *  - `remove`: the mentor stopped recording; how to remove the config (screen 7)
 *  - `check`: the removal check runs, waiting for "Xong" (screen 8)
 *  - `check-failed` / `removed`: the verdict of that check (screen 8)
 *  - `sending-stopped`: the member pressed "Dừng gửi" while open: nothing more is sent, the data waits for the mentor (screen 10)
 *  - `deleted`: the mentor approved deleting a stopped member's data (screen 11)
 *  - `ended`: the training ended or the server no longer knows this member (screen 9)
 *  - `lost`: no token and the room code does not lead here (wrong code, training stopped, no code in the address)
 *  - `offline`: nothing known yet and the mentor's machine cannot be reached (screen 9b; once something is known, a banner instead)
 */
export type TrainingScreen = 'loading' | 'offline' | 'lost' | 'consent' | 'install' | 'recording' | 'remove' | 'check' | 'check-failed' | 'removed' | 'sending-stopped' | 'deleted' | 'ended';

/** Looking up the room code (only while this browser has no token): it gives the training's title for the consent screen. */
export interface RoomInfo {
  status: 'none' | 'checking' | 'ok' | 'error';
  /** HTTP status of the failure (0 = no connection). */
  errorStatus?: number;
}

/** This browser's own side of the removal check: set when "Kiểm tra đã gỡ" is pressed, so the page can show the verdict at once. */
export interface CheckProgress {
  phase: 'idle' | 'starting' | 'running' | 'finishing';
  result: 'passed' | 'failed' | null;
}

export interface TrainingScreenInput {
  hasToken: boolean;
  /** The server no longer knows this member (401: training ended, withdrawn, removed by the mentor, database reset). */
  gone: boolean;
  /** `gone`, and the last thing known was that this member had stopped sending: the mentor approved deleting their data. */
  deleted?: boolean;
  me: MyTraining | null;
  /** The last request never reached the mentor's machine. */
  offline: boolean;
  room: RoomInfo;
  check: CheckProgress;
}

/** Pure, so every combination of status, connection and removal check is testable. */
export function decideTrainingScreen({ hasToken, gone, deleted = false, me, offline, room, check }: TrainingScreenInput): TrainingScreen {
  if (gone) return deleted ? 'deleted' : 'ended';
  if (!hasToken) {
    if (room.status === 'ok') return 'consent';
    if (room.status === 'error') return room.errorStatus === 0 ? 'offline' : 'lost';
    return room.status === 'checking' ? 'loading' : 'lost';
  }
  if (!me) return offline ? 'offline' : 'loading';
  const { training, member } = me;
  if (training.status === 'ended') return 'ended';
  if (training.status === 'open') {
    if (member.connection === 'stopped_sending') return 'sending-stopped';
    return member.connection === 'waiting' ? 'install' : 'recording';
  }

  // stopped: from here on it is about removing the config
  if (member.uninstallCheck === 'passed' || check.result === 'passed') return 'removed';
  if (check.result === 'failed') return 'check-failed';
  if (check.phase !== 'idle') return 'check'; // this browser's own check wins over what the server last said (an event may have arrived during it)
  if (member.uninstallCheck === 'waiting') return 'check'; // the page was reloaded mid-check
  if (member.uninstallCheck === 'failed') return 'check-failed';
  return 'remove';
}
