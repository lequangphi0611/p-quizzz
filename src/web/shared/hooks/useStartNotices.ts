import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionStartInfo } from '../../../shared/session-start.js';
import { nextStartNotices, type StartNotice } from '../format/start.js';
import { useMediaQuery } from './useMediaQuery.js';

let ids = 0;

/**
 * Change notices while the session waits to start (PRODUCT.md §7.31b, c): "Giờ bắt đầu đã đổi…", "Mentor đã bỏ giờ hẹn",
 * "Đếm ngược đã dừng". Built from what this page saw change between refetches; a reload starts with none.
 * `ttlMs` drops a notice after that long (the projector), otherwise it stays until dismissed.
 */
export function useStartNotices(start: SessionStartInfo | null, sessionId: number | null, ttlMs?: number): { notices: StartNotice[]; dismiss: (id: number) => void; changedAt: number | null } {
  const [notices, setNotices] = useState<StartNotice[]>([]);
  const prev = useRef<{ id: number | null; start: SessionStartInfo | null }>({ id: sessionId, start });

  useEffect(() => {
    const before = prev.current;
    prev.current = { id: sessionId, start };
    if (before.id !== sessionId) { setNotices([]); return; }
    setNotices(list => nextStartNotices(before.start, start, list, Date.now(), () => ++ids));
  }, [start, sessionId]);

  useEffect(() => {
    if (!ttlMs || notices.length === 0) return;
    const oldest = Math.min(...notices.map(n => n.at));
    const t = setTimeout(() => setNotices(list => list.filter(n => Date.now() - n.at < ttlMs)), Math.max(0, oldest + ttlMs - Date.now()));
    return () => clearTimeout(t);
  }, [notices, ttlMs]);

  const dismiss = useCallback((id: number) => setNotices(list => list.filter(n => n.id !== id)), []);
  const latestTime = notices.find(n => n.kind === 'time');
  return { notices, dismiss, changedAt: latestTime ? latestTime.at : null };
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
