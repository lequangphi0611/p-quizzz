import { randomInt } from 'node:crypto';

// Fisher–Yates on a copy. `rand(n)` returns an integer in [0, n); crypto.randomInt by default so the order
// cannot be predicted from a neighbour's. Injectable for tests.
export function shuffled<T>(items: readonly T[], rand: (n: number) => number = n => randomInt(n)): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
