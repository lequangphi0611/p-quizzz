export type ShortcutAction = 'next' | 'prev' | 'close' | 'toggle-hidden' | 'next-draft';

export interface KeyLike { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }

/**
 * J = the command after, K = the command before (the timeline runs old to new, top to bottom), Esc closes the panel, H hides content,
 * D (draft) goes to the next AI draft nobody has opened (S45), not while a dialog or popup is open. N stays the notification bell's (shared/ui/session-shortcuts.ts).
 */
export function shortcutFor(e: KeyLike, ctx: { panelOpen: boolean; turnOpen?: boolean; dialogOpen?: boolean }): ShortcutAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.key === 'h' || e.key === 'H') return 'toggle-hidden';
  if ((e.key === 'd' || e.key === 'D') && !ctx.dialogOpen && !ctx.turnOpen) return 'next-draft';
  if (e.key === 'Escape' && ctx.turnOpen) return 'close';
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
