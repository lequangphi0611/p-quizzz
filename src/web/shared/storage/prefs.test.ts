import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREF_KEYS, readPref, writePref } from './prefs.js';

afterEach(() => vi.unstubAllGlobals());

describe('prefs', () => {
  it('round-trips a value, and an unknown key is null', () => {
    const m = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) });
    expect(readPref('a')).toBeNull();
    writePref('a', '1');
    expect(readPref('a')).toBe('1');
  });

  it('never throws when storage is blocked or missing', () => {
    const blocked = () => { throw new Error('blocked'); };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(readPref('a')).toBeNull();
    expect(() => writePref('a', '1')).not.toThrow();
    vi.stubGlobal('localStorage', undefined);
    expect(readPref('a')).toBeNull();
  });

  it('keys are per session for the reminder', () => {
    expect(PREF_KEYS.saveReminderOff(3)).not.toBe(PREF_KEYS.saveReminderOff(4));
  });
});
