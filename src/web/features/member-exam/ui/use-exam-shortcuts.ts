import { useEffect, useRef } from 'react';
import type { MemberQuestion } from '../../../../shared/api/index.js';
import type { TakingController } from '../application/taking-controller.js';
import { shortcutFor } from '../domain/shortcuts.js';

/**
 * Window-level keyboard shortcuts of the taking screen (PRODUCT.md §7.18). The rules live in domain/shortcuts;
 * this only reads the event, asks the domain what it means and calls the controller.
 */
export function useExamShortcuts({ ctrl, q, cur, overlay, help, sheet, onHelp, onCloseHelp, onCloseSheet }: {
  ctrl: TakingController | null; q: MemberQuestion | undefined; cur: number; overlay: boolean; help: boolean; sheet: boolean;
  onHelp: () => void; onCloseHelp: () => void; onCloseSheet: () => void;
}) {
  const handler = useRef<(e: KeyboardEvent) => void>(() => {});
  handler.current = e => {
    const t = e.target as HTMLElement | null;
    const inField = !!t?.closest?.('input,textarea,select,[contenteditable="true"]');
    const a = shortcutFor({ key: e.key, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, inField, overlay });
    if (!a || !q || !ctrl) return;
    if (a.kind === 'close') { if (help) onCloseHelp(); else if (sheet) onCloseSheet(); return; } // the confirm dialog handles its own Esc
    if (a.kind === 'blur') { t?.blur(); return; }
    e.preventDefault();
    if (a.kind === 'prev') ctrl.go(cur - 1);
    else if (a.kind === 'next') ctrl.go(cur + 1);
    else if (a.kind === 'help') onHelp();
    else if (a.kind === 'pick' && q.type !== 'essay') { const o = q.options[a.index]; if (o) ctrl.pick(q, o.id); }
  };
  useEffect(() => { const h = (e: KeyboardEvent) => handler.current(e); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);
}
