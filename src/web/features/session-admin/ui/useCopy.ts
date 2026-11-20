import { useState } from 'react';

/** Copies text; `copied` stays true for 2 seconds. Without clipboard access (plain http) the text stays selectable. */
export function useCopy(): { copied: boolean; copy: (text: string) => Promise<void> } {
  const [copied, setCopied] = useState(false);
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* select the text by hand */ }
  }
  return { copied, copy };
}
