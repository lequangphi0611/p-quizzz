// Small per-browser conveniences (a remembered choice, a dismissed reminder). Storage can throw or be missing
// (private mode, blocked site data): reading then gives `null` and writing is dropped, so the UI never depends on it.

export function readPref(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function writePref(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export const PREF_KEYS = {
  /** The "Ai được vào" choice the mentor used last time, offered first next time. */
  lastAccess: 'pq:mentor:last-access',
  /** "Để sau" / "đã lưu" on the reminder to save a typed list as a group; one flag per session. */
  saveReminderOff: (sessionId: number) => `pq:mentor:save-group-reminder-off:${sessionId}`,
} as const;
