import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageTrainingTokenStore } from './local-storage-training-token-store.js';

afterEach(() => vi.unstubAllGlobals());

const fakeStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

describe('LocalStorageTrainingTokenStore', () => {
  it('keeps one token per training under pq:training:<id>, and clears it', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    const s = new LocalStorageTrainingTokenStore();
    expect(s.get(7)).toBeNull();
    s.set(7, 'a');
    s.set(8, 'b');
    expect([...storage.m.entries()]).toEqual([['pq:training:7', 'a'], ['pq:training:8', 'b']]);
    expect(s.get(7)).toBe('a');
    s.clear(7);
    expect(s.get(7)).toBeNull();
    expect(s.get(8)).toBe('b');
  });

  it('never throws when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    vi.stubGlobal('localStorage', blocked);
    const s = new LocalStorageTrainingTokenStore();
    expect(s.get(1)).toBeNull();
    expect(() => { s.set(1, 'a'); s.clear(1); }).not.toThrow();
  });
});
