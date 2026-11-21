export type ShortcutAction = 'next' | 'prev' | 'close' | 'toggle-hidden';

export interface KeyLike { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }

/** J = the command after, K = the command before (the timeline runs old to new, top to bottom), Esc closes the panel, H hides content. */
export function shortcutFor(e: KeyLike, ctx: { panelOpen: boolean }): ShortcutAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.key === 'h' || e.key === 'H') return 'toggle-hidden';
  if (!ctx.panelOpen) return null;
  if (e.key === 'j' || e.key === 'J') return 'next';
  if (e.key === 'k' || e.key === 'K') return 'prev';
  if (e.key === 'Escape') return 'close';
  return null;
}

/** Keys typed into a field are text, not shortcuts. */
export function isTypingTarget(el: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!el) return false;
  const tag = (el.tagName ?? '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}
