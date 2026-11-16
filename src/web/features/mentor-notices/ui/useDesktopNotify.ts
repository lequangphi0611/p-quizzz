import { useCallback, useEffect, useRef, useState } from 'react';
import { DESKTOP_BURST_MS, desktopNotifications, newPendingNotices } from '../domain/mentor-notices.js';
import type { MentorNoticesState } from '../application/use-mentor-notices.js';

// OS notifications need a secure context: http://localhost works, http://<LAN IP> does not.
export type DesktopNotifyStatus = 'unsupported' | 'denied' | 'off' | 'on';

const PREF_KEY = 'pq:mentor:desktop-notify';
const loadPref = () => { try { return localStorage.getItem(PREF_KEY) === '1'; } catch { return false; } };
const savePref = (on: boolean) => { try { localStorage.setItem(PREF_KEY, on ? '1' : '0'); } catch { /* ignore */ } };
const supported = () => typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext;

function currentStatus(enabled: boolean): DesktopNotifyStatus {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return enabled && Notification.permission === 'granted' ? 'on' : 'off';
}

/**
 * Pops an OS notification when someone new waits for approval while the mentor is not looking at
 * the admin page (tab hidden or another window focused). Clicking it focuses the tab and opens the session.
 */
export function useDesktopNotify(state: MentorNoticesState, onOpenSession: (id: number) => void) {
  const [enabled, setEnabled] = useState(loadPref);
  const [status, setStatus] = useState<DesktopNotifyStatus>(() => currentStatus(loadPref()));
  const known = useRef<{ sessionId: number; keys: Set<string> } | null>(null);
  const lastPopAt = useRef(0);
  const openRef = useRef(onOpenSession);
  openRef.current = onOpenSession;

  const { session, loaded, notices, pending } = state;
  useEffect(() => {
    if (!session || !loaded) return;
    const prev = known.current?.sessionId === session.id ? known.current.keys : null;
    const fresh = newPendingNotices(prev, notices);
    known.current = { sessionId: session.id, keys: new Set(notices.map(n => n.key)) };
    if (!fresh.length || currentStatus(enabled) !== 'on') return;
    if (document.visibilityState === 'visible' && document.hasFocus()) return; // the bell is enough
    const now = Date.now();
    const inBurst = now - lastPopAt.current < DESKTOP_BURST_MS;
    lastPopAt.current = now;
    for (const n of desktopNotifications(fresh, pending, inBurst)) {
      try {
        const note = new Notification(n.title, { body: n.body, tag: n.tag });
        const id = session.id;
        note.onclick = () => { window.focus(); openRef.current(id); note.close(); };
      } catch { /* some browsers only allow notifications from a service worker */ }
    }
  }, [session, loaded, notices, pending, enabled]);

  const enable = useCallback(async () => {
    if (!supported()) return;
    const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    const on = perm === 'granted';
    setEnabled(on);
    savePref(on);
    setStatus(currentStatus(on));
  }, []);
  const disable = useCallback(() => { setEnabled(false); savePref(false); setStatus(currentStatus(false)); }, []);

  return { status, enable, disable };
}
