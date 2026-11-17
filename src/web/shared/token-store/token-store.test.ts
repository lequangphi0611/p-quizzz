import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryTokenStore } from './in-memory-token-store.js';
import { LocalStorageTokenStore } from './local-storage-token-store.js';
import type { TokenStore } from './token-store.js';

function stubStorage() {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) });
  return m;
}
afterEach(() => vi.unstubAllGlobals());

// The same contract must hold for the real store and the test double.
const stores: [string, () => TokenStore][] = [
  ['LocalStorageTokenStore', () => { stubStorage(); return new LocalStorageTokenStore(); }],
  ['InMemoryTokenStore', () => new InMemoryTokenStore()],
];

describe.each(stores)('%s', (_name, make) => {
  it('keeps one token per session and clears them independently', () => {
    const s = make();
    expect(s.getToken(1)).toBeNull();
    s.setToken(1, 'a');
    s.setToken('2', 'b');
    expect(s.getToken('1')).toBe('a');
    expect(s.getToken(2)).toBe('b');
    s.clearToken(1);
    expect(s.getToken(1)).toBeNull();
    expect(s.getToken(2)).toBe('b');
  });

  it('remembers the current session as a string, and can forget it', () => {
    const s = make();
    expect(s.getCurrentSessionId()).toBeNull();
    s.setCurrentSessionId(7);
    expect(s.getCurrentSessionId()).toBe('7');
    s.clearCurrentSessionId();
    expect(s.getCurrentSessionId()).toBeNull();
  });
});

describe('LocalStorageTokenStore: the current session belongs to the tab', () => {
  function tabStorage() {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  }

  it('two tabs following two parallel sessions do not swap each other\'s pointer', () => {
    const shared = tabStorage(); // localStorage: shared by the tabs
    vi.stubGlobal('localStorage', shared);
    const tabA = tabStorage(), tabB = tabStorage();
    const store = new LocalStorageTokenStore();

    vi.stubGlobal('sessionStorage', tabA);
    store.setCurrentSessionId(1);
    vi.stubGlobal('sessionStorage', tabB);
    store.setCurrentSessionId(2);

    vi.stubGlobal('sessionStorage', tabA);
    expect(store.getCurrentSessionId()).toBe('1'); // not 2
    vi.stubGlobal('sessionStorage', tabB);
    expect(store.getCurrentSessionId()).toBe('2');
  });

  it('a brand-new tab resumes the last session any tab followed', () => {
    vi.stubGlobal('localStorage', tabStorage());
    vi.stubGlobal('sessionStorage', tabStorage());
    new LocalStorageTokenStore().setCurrentSessionId(5);
    vi.stubGlobal('sessionStorage', tabStorage()); // new tab: empty sessionStorage
    expect(new LocalStorageTokenStore().getCurrentSessionId()).toBe('5');
  });
});

describe('LocalStorageTokenStore storage keys', () => {
  it('keeps the keys older tabs already wrote (no forced re-login after the refactor)', () => {
    const m = stubStorage();
    const s = new LocalStorageTokenStore();
    s.setToken(3, 't');
    s.setCurrentSessionId(3);
    expect([...m.entries()].sort()).toEqual([['pq-current-session', '3'], ['pq:participant:3', 't']]);
  });

  it('never throws when storage is blocked', () => {
    const blocked = () => { throw new Error('blocked'); };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    const s = new LocalStorageTokenStore();
    expect(() => { s.setToken(1, 'x'); s.clearToken(1); s.setCurrentSessionId(1); }).not.toThrow();
    expect(s.getToken(1)).toBeNull();
    expect(s.getCurrentSessionId()).toBeNull();
  });

  it('never throws when localStorage does not exist', () => {
    vi.stubGlobal('localStorage', undefined);
    const s = new LocalStorageTokenStore();
    expect(s.getToken(1)).toBeNull();
    expect(() => s.setToken(1, 'x')).not.toThrow();
  });
});
