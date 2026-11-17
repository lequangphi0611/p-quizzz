import { useEffect, useState } from 'react';
import type { SessionTimer } from '../../../shared/session-timer.js';

/**
 * Milliseconds left on the session clock, ticking locally. Anchored on the server's `remainingMs` when the timer
 * arrives (not on `endsAt`), so a device whose clock is wrong still counts down correctly; every refetch re-anchors.
 * Null when there is no running clock.
 */
export function useCountdown(timer: SessionTimer | null | undefined): number | null {
  const remaining = timer?.remainingMs ?? null;
  const endsAt = timer?.endsAt ?? null;
  const [left, setLeft] = useState<number | null>(remaining);

  useEffect(() => {
    if (remaining === null) { setLeft(null); return; }
    const anchor = performance.now();
    const tick = () => setLeft(Math.max(0, remaining - (performance.now() - anchor)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [remaining, endsAt]);

  return left;
}
