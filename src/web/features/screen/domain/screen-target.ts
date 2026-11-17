import type { ScreenSessionItem, ScreenSessions } from '../../../../shared/api/index.js';

/** What `/screen` (no session in the address) does: follow the only open session, let the mentor pick, or wait. */
export type ScreenTarget =
  | { kind: 'go'; sessionId: number }
  | { kind: 'choose'; sessions: ScreenSessionItem[] }
  | { kind: 'none' };

export function decideScreenTarget(list: ScreenSessions): ScreenTarget {
  if (list.open.length === 1) return { kind: 'go', sessionId: list.open[0]!.id };
  if (list.open.length > 1) return { kind: 'choose', sessions: list.open };
  // Nothing open: show how the last one ended (results), as before.
  return list.latestEnded ? { kind: 'go', sessionId: list.latestEnded.id } : { kind: 'none' };
}
