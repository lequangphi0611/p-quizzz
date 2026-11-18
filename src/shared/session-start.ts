// How a session starts (PRODUCT.md §7.31): the mentor's "Bắt đầu ngay", a scheduled time, or everyone being ready,
// whichever comes first. "Bắt đầu ngay" and "everyone ready" go through a 10-second countdown; the scheduled time does not
// (its countdown was on screen all along). Pure: shared by the server (when to start) and the web (labels, countdowns).

/** The countdown before "Bắt đầu ngay" or "everyone ready" actually starts the session (PRODUCT.md §7.31c). Fixed. */
export const START_COUNTDOWN_MS = 10_000;

/**
 * A start time that passed more than this long ago is never acted on: the mentor's machine was off or asleep then, nobody
 * could have been in the room, and starting now would run the clock on an empty room (PRODUCT.md §7.31b). The watcher
 * ticks every second, so a start it should take is at most about a second late.
 */
export const START_LATE_TOLERANCE_MS = 15_000;

/** Most people the mentor can require before "everyone ready" may start the session. */
export const MAX_READY_MIN = 500;

/** What set the 10-second countdown going. */
export type CountdownSource = 'now' | 'ready';

/** The start the session is heading for: the scheduled time or the end of the countdown, whichever is earlier. */
export function effectiveStartAt(scheduledAt: Date | null, countdownEndsAt: Date | null): Date | null {
  if (!scheduledAt) return countdownEndsAt;
  if (!countdownEndsAt) return scheduledAt;
  return scheduledAt.getTime() <= countdownEndsAt.getTime() ? scheduledAt : countdownEndsAt;
}

/**
 * What every client is told about the start while the session has not started. Counts only: never who is ready or
 * who waits for approval (PRODUCT.md §7.31d, h). `startsInMs` is computed by the server when it answers, so a device
 * whose clock is wrong still counts down correctly.
 */
export interface SessionStartInfo {
  scheduledAt: number | null; // epoch ms: the mentor's scheduled time
  countdownEndsAt: number | null; // epoch ms: end of the 10-second countdown, while one runs
  countdownSource: CountdownSource | null;
  startsAt: number | null; // epoch ms: the earlier of the two; null = waiting for the mentor (or everyone ready)
  startsInMs: number | null; // ms left when the server answered (0 once due)
  /** A countdown that ends before the scheduled time: the mentor (or the room) is starting early. */
  early: boolean;
  autoStartReady: boolean;
  /** People required for "everyone ready" to start the session; null while that option is off. */
  readyMin: number | null;
  /** Ready / approved people in the room (people who lost their connection count, PRODUCT.md §7.31d). */
  ready: { count: number; total: number };
}

export interface StartFacts {
  scheduledStartAt: Date | null;
  countdownEndsAt: Date | null;
  countdownSource: CountdownSource | null;
  autoStartReady: boolean;
  readyMin: number | null;
}

export function startInfoOf(s: StartFacts, ready: { count: number; total: number }, now: Date): SessionStartInfo {
  const startsAt = effectiveStartAt(s.scheduledStartAt, s.countdownEndsAt);
  const early = !!s.countdownEndsAt && !!s.scheduledStartAt && s.countdownEndsAt.getTime() < s.scheduledStartAt.getTime();
  return {
    scheduledAt: s.scheduledStartAt?.getTime() ?? null,
    countdownEndsAt: s.countdownEndsAt?.getTime() ?? null,
    countdownSource: s.countdownEndsAt ? s.countdownSource : null,
    startsAt: startsAt?.getTime() ?? null,
    startsInMs: startsAt ? Math.max(0, startsAt.getTime() - now.getTime()) : null,
    early,
    autoStartReady: s.autoStartReady,
    readyMin: s.autoStartReady ? s.readyMin : null,
    ready,
  };
}
