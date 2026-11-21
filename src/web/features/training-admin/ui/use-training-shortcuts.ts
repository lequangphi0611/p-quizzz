import { useEffect, useRef } from 'react';
import type { TrainingController } from '../application/training-controller.js';
import { isTypingTarget, shortcutFor } from '../domain/shortcuts.js';

/**
 * H hides / shows the content, J / K step through commands and Esc closes the panel (or a confirmation). Never while typing in
 * a field, and not with Ctrl / Cmd / Alt held. `closePanel` is the page's own close, which also returns the focus.
 */
export function useTrainingShortcuts(ctrl: TrainingController, closePanel: () => void): void {
  const close = useRef(closePanel);
  close.current = closePanel;
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || isTypingTarget(e.target as HTMLElement | null)) return;
      const s = ctrl.getState();
      if (s.confirm) {
        if (e.key === 'Escape') ctrl.cancelConfirm(); // the dialogs sit on top: nothing else reacts to keys behind them
        return;
      }
      const action = shortcutFor(e, { panelOpen: s.panel !== null, turnOpen: s.turnKey !== null });
      if (!action) return;
      e.preventDefault();
      if (action === 'toggle-hidden') ctrl.toggleHidden();
      else if (action === 'next') ctrl.step(1);
      else if (action === 'prev') ctrl.step(-1);
      else close.current();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [ctrl]);
}
