import type { TrainingScreen } from './training-screen.js';

/** How long the install screen waits for the first signal before it suggests what may be wrong. */
export const STUCK_HINT_AFTER_MS = 60_000;
/** The removal check needs a quiet moment to mean anything (the server refuses a verdict sooner than this). */
export const CHECK_WAIT_MS = 5_000;
/** After the server said "too early" (clock difference, or the page was reloaded mid-check): wait this much more. */
export const CHECK_RETRY_WAIT_MS = 2_000;

export const FAST_POLL_MS = 3_000;
/** While the member only needs to hear about big changes (the mentor stopped recording, the training ended). */
export const SLOW_POLL_MS = 10_000;

/** `since` = when the install screen began waiting. */
export const showWaitingHint = (since: number | null, now: number): boolean => since !== null && now - since >= STUCK_HINT_AFTER_MS;

/** Whole seconds until "Xong" unlocks; 0 once it may be pressed. `readyAt` null = not counting yet. */
export const checkSecondsLeft = (readyAt: number | null, now: number): number =>
  readyAt === null ? 0 : Math.min(CHECK_WAIT_MS / 1000, Math.max(0, Math.ceil((readyAt - now) / 1000))); // capped: a clock tick that lags a render must not show "6"


/**
 * How often `GET /api/training/me` is asked, or null for never.
 * Fast only while a change is expected within seconds: the first signal and the removal check. While recording
 * (and while the member is following the removal steps) a slow poll is enough to notice "Dừng thu" or "Kết thúc".
 * An unreachable mentor's machine is retried fast, whatever the screen.
 */
export function pollDelayMs(screen: TrainingScreen, offline: boolean): number | null {
  if (screen === 'consent' || screen === 'lost' || screen === 'ended' || screen === 'removed') return null;
  if (offline || screen === 'offline') return FAST_POLL_MS;
  if (screen === 'install' || screen === 'check' || screen === 'loading') return FAST_POLL_MS;
  return SLOW_POLL_MS; // recording, remove, check-failed
}
