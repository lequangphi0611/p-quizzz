import { describe, expect, it } from 'vitest';
import { shuffled } from './shuffle.js';

describe('shuffled', () => {
  it('returns a permutation and leaves the input untouched', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffled(input);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('is Fisher–Yates: picking index 0 each time reverses nothing it should not (deterministic rand)', () => {
    expect(shuffled([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
    expect(shuffled([1, 2, 3, 4], n => n - 1)).toEqual([1, 2, 3, 4]); // always "swap with itself"
  });
  it('handles empty and single-element lists', () => {
    expect(shuffled([])).toEqual([]);
    expect(shuffled([7])).toEqual([7]);
  });
  it('reaches every permutation of 3 items with the default (crypto) generator', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) seen.add(shuffled([1, 2, 3]).join(','));
    expect(seen.size).toBe(6);
  });
});
