/** Is the keyboard focus somewhere the user is typing? Shortcuts must stay out of the way then. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null;
  if (!el?.tagName) return false;
  return el.isContentEditable === true || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** `Alt+1`…`Alt+9` → the slot to jump to, or null. Uses `code` so the digit works whatever the keyboard layout/Alt produces. */
export function slotFromShortcut(e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; code?: string; key: string }): number | null {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null;
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code ?? '') ?? /^([1-9])$/.exec(e.key);
  return m ? Number(m[1]) : null;
}

/** Plain `N` (no modifiers) outside a text field toggles the notification bell. */
export function isBellShortcut(e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; key: string; target: EventTarget | null }): boolean {
  return e.key.toLowerCase() === 'n' && !e.altKey && !e.ctrlKey && !e.metaKey && !isTypingTarget(e.target);
}
