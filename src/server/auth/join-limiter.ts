// Limits wrong room codes per client address: the code is only 6 digits, so guessing must be slowed down.
// In-memory is enough: one process, one room.
export interface JoinLimiter {
  /** Seconds until this address may try again, or 0 when it is allowed now. */
  retryAfter(key: string): number;
  /** Record one wrong code. */
  fail(key: string): void;
}

export function createJoinLimiter({ max = 5, windowMs = 60_000, now = Date.now, maxKeys = 5000 }: { max?: number; windowMs?: number; now?: () => number; maxKeys?: number } = {}): JoinLimiter {
  const failures = new Map<string, number[]>();

  const recent = (key: string): number[] => {
    const t = now();
    const list = (failures.get(key) ?? []).filter(x => t - x < windowMs);
    if (list.length === 0) failures.delete(key);
    else failures.set(key, list);
    return list;
  };

  return {
    retryAfter(key) {
      const list = recent(key);
      if (list.length < max) return 0;
      return Math.max(1, Math.ceil((list[0]! + windowMs - now()) / 1000)); // when the oldest failure leaves the window
    },
    fail(key) {
      if (failures.size >= maxKeys && !failures.has(key)) failures.delete(failures.keys().next().value as string); // bounded memory
      failures.set(key, [...recent(key), now()]);
    },
  };
}
