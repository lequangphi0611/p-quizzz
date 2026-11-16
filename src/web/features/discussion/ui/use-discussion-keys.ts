import { useEffect, useRef } from 'react';
import { discussionKeyAction, type DiscussionKeyAction, type KeyContext } from '../domain/shortcuts.js';

/** Window keydown → pure key map → `run`. Always uses the latest context and callback without rebinding. */
export function useDiscussionKeys(ctx: KeyContext, run: (a: DiscussionKeyAction, e: KeyboardEvent) => void) {
  const latest = useRef<(e: KeyboardEvent) => void>(() => {});
  latest.current = e => {
    const action = discussionKeyAction({ key: e.key, tag: (e.target as HTMLElement | null)?.tagName ?? '', altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey }, ctx);
    if (!action) return;
    if (action.kind !== 'closeDialog' && action.kind !== 'backToList') e.preventDefault();
    run(action, e);
  };
  useEffect(() => { const h = (e: KeyboardEvent) => latest.current(e); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);
}
