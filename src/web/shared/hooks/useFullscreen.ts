import { useCallback, useEffect, useState } from 'react';

/** Tracks `document.fullscreenElement`; `toggle` enters/leaves fullscreen (ignored where the API is blocked). */
export function useFullscreen(): { fullscreen: boolean; toggle: () => void; leave: () => void } {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  const leave = useCallback(() => { if (document.fullscreenElement) void document.exitFullscreen(); }, []);
  const toggle = useCallback(() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.().catch(() => {}); }, []);
  return { fullscreen, toggle, leave };
}
