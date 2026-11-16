/**
 * A member's browser asks the server about itself every 5 seconds (`/api/me`) while the page is open, so silence for three
 * rounds means the tab was closed, the device slept or the Wi-Fi dropped. Only the mentor sees this (PRODUCT.md §7.23b).
 */
export const ONLINE_WITHIN_MS = 15_000;

export interface Connection {
  online: boolean;
  /** Epoch ms of the last sign of life; null when the server has not heard from them since it started. */
  lastSeenAt: number | null;
}

export function connectionOf(lastSeen: Date | null, now: Date): Connection {
  if (!lastSeen) return { online: false, lastSeenAt: null };
  return { online: now.getTime() - lastSeen.getTime() <= ONLINE_WITHIN_MS, lastSeenAt: lastSeen.getTime() };
}
