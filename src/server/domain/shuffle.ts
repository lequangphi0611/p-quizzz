/** Returns an integer in [0, maxExclusive). Supplied by the caller so the shuffle stays deterministic in tests. */
export type RandomInt = (maxExclusive: number) => number;

// Fisher–Yates on a copy. Pass a cryptographic `randomInt` in production so one member's order
// cannot be predicted from another's.
export function shuffled<T>(items: readonly T[], randomInt: RandomInt): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
