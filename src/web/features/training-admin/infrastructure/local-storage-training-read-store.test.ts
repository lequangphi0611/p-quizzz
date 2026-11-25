import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageTrainingReadStore, parseReadState } from './local-storage-training-read-store.js';

class MemoryStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

let storage: MemoryStorage;
beforeEach(() => { storage = new MemoryStorage(); vi.stubGlobal('localStorage', storage); });
afterEach(() => { vi.unstubAllGlobals(); });

const record = { baselineAt: 10, baselinePromptCount: 2, readPromptCount: 1, turns: { '5': 9 } };

describe('LocalStorageTrainingReadStore', () => {
  it('saves and loads under pq:mentor:training-read:<id>', () => {
    const store = new LocalStorageTrainingReadStore();
    store.save(7, { members: { '1': record } });
    expect(storage.getItem('pq:mentor:training-read:7')).not.toBeNull();
    expect(store.load(7)).toEqual({ members: { '1': record } });
    expect(store.load(8)).toEqual({ members: {} });
  });

  it('never throws when storage is blocked: loads as empty, ignores writes', () => {
    const blocked = { get length(): number { throw new Error('denied'); }, key: () => { throw new Error('denied'); }, getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
    vi.stubGlobal('localStorage', blocked);
    const store = new LocalStorageTrainingReadStore();
    expect(store.load(1)).toEqual({ members: {} });
    expect(() => { store.save(1, { members: {} }); store.clear(1); store.clearExcept([]); }).not.toThrow();
  });

  it('treats damaged data as the first time', () => {
    for (const raw of ['not json', '[]', '{"members":5}', 'null', '{"members":{"1":{"baselineAt":"x"}}}']) {
      expect(parseReadState(raw)).toEqual({ members: {} });
    }
    expect(parseReadState(JSON.stringify({ members: { '1': record, '2': { nope: true }, '3': { ...record, turns: { a: 'bad', '1': 4 } } } }))).toEqual({ members: { '1': record, '3': { ...record, turns: { '1': 4 } } } });
  });

  it('clear removes one training; clearExcept removes the ones that are not live (and only ours)', () => {
    const store = new LocalStorageTrainingReadStore();
    store.save(1, { members: {} }); store.save(2, { members: {} }); store.save(3, { members: {} });
    storage.setItem('other-key', 'x');
    store.clear(1);
    expect(storage.getItem('pq:mentor:training-read:1')).toBeNull();
    store.clearExcept([2]);
    expect([...storage.data.keys()].sort()).toEqual(['other-key', 'pq:mentor:training-read:2']);
  });
});
