/** What `copyText` needs from the browser; a parameter so it can be tested without one. */
export interface CopyEnv {
  clipboard?: { writeText(text: string): Promise<void> } | undefined;
  /** Old-style copy of the current selection (works on plain http, where `navigator.clipboard` does not exist). */
  execCopy?: (text: string) => boolean;
}

function browserExecCopy(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  Object.assign(area.style, { position: 'fixed', top: '0', left: '0', opacity: '0', pointerEvents: 'none' });
  document.body.appendChild(area);
  const keep = document.activeElement as HTMLElement | null;
  try {
    area.select();
    return document.execCommand('copy');
  } finally {
    area.remove();
    keep?.focus?.();
  }
}

function browserEnv(): CopyEnv {
  return { clipboard: typeof navigator !== 'undefined' && window.isSecureContext ? navigator.clipboard : undefined, execCopy: browserExecCopy };
}

/**
 * Copies `text`. The app is opened over plain http on the LAN, where the Clipboard API is missing, so: the Clipboard API
 * when there is one, then the old selection-based copy, and `false` when neither worked (the caller then selects the text
 * so the member can press Ctrl+C). Never throws.
 */
export async function copyText(text: string, env: CopyEnv = browserEnv()): Promise<boolean> {
  try {
    if (env.clipboard) { await env.clipboard.writeText(text); return true; }
  } catch { /* fall through to the old way */ }
  try {
    return env.execCopy?.(text) ?? false;
  } catch {
    return false;
  }
}
