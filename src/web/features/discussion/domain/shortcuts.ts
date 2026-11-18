// Keyboard map of the projector discussion screen (S17). Pure: the caller reads the DOM event and the screen state.

export type DiscussionKeyAction =
  | { kind: 'question'; delta: 1 | -1 }
  | { kind: 'toggleAnswer' }
  | { kind: 'toggleOrder' }
  | { kind: 'paper'; dir: 1 | -1 }
  | { kind: 'backToList' }
  | { kind: 'closeDialog' };

export interface KeyContext {
  /** The finalize dialog is open. */
  dialog: boolean;
  finalizing: boolean;
  /** Data loaded and a question is on screen. */
  ready: boolean;
  /** The current question is an essay with at least one non-blank paper. */
  hasPapers: boolean;
  mode: 'list' | 'paper';
  fullscreen: boolean;
}

/** ← → question · Space answer · S "Cần bàn trước" order · J K paper · Esc back to the list (the browser uses Esc to leave fullscreen). */
export function discussionKeyAction(e: { key: string; tag: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }, c: KeyContext): DiscussionKeyAction | null {
  if (e.tag === 'INPUT' || e.tag === 'TEXTAREA' || e.altKey || e.ctrlKey || e.metaKey) return null;
  const k = e.key.toLowerCase();
  if (c.dialog) return k === 'escape' && !c.finalizing ? { kind: 'closeDialog' } : null;
  if (!c.ready) return null;
  if (k === 'arrowright') return { kind: 'question', delta: 1 };
  if (k === 'arrowleft') return { kind: 'question', delta: -1 };
  if (k === ' ') return { kind: 'toggleAnswer' };
  if (k === 's') return { kind: 'toggleOrder' };
  if ((k === 'j' || k === 'k') && c.hasPapers) return { kind: 'paper', dir: k === 'j' ? 1 : -1 };
  if (k === 'escape' && c.mode === 'paper' && !c.fullscreen) return { kind: 'backToList' };
  return null;
}
