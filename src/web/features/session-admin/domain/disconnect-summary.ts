import type { SessionParticipantDetail } from '../../../../shared/api/index.js';

/** Drops closer together than this are one event (a classroom's Wi-Fi going down), not people leaving one by one. */
export const MASS_WINDOW_MS = 30_000;
/** At least this many at once makes a banner instead of a row of warnings. */
export const MASS_MIN = 3;
/** A drop older than this is history, not news. */
const RECENT_MS = 5 * 60_000;

export interface MassDisconnect {
  count: number;
  /** When the first of them went quiet (epoch ms). */
  since: number;
}

/**
 * "4 người ngắt kết nối cùng lúc": three or more members whose last sign of life fell within 30 seconds of each other and
 * who are still offline (PRODUCT.md §7.23h). Pure, so the rule is testable; each person still shows their own status.
 */
export function massDisconnect(participants: readonly Pick<SessionParticipantDetail, 'status' | 'connection'>[], now: number): MassDisconnect | null {
  const drops = participants
    .filter(p => p.status !== 'kicked' && !p.connection.online && p.connection.lastSeenAt !== null && now - p.connection.lastSeenAt <= RECENT_MS)
    .map(p => p.connection.lastSeenAt as number)
    .sort((a, b) => a - b);
  let best: MassDisconnect | null = null;
  let start = 0;
  for (let end = 0; end < drops.length; end++) {
    while (drops[end]! - drops[start]! > MASS_WINDOW_MS) start++;
    const count = end - start + 1;
    if (count >= MASS_MIN && (!best || count > best.count)) best = { count, since: drops[start]! };
  }
  return best;
}

/** "còn 7 phút": what is left of the mentor's one-time "let them back in" permission, or null when none. */
export function allowRemainingMinutes(until: number | null, now: number): number | null {
  if (until === null || until <= now) return null;
  return Math.max(1, Math.ceil((until - now) / 60_000));
}
