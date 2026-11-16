import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useExamGateway } from './exam-gateway-context.js';
import { TakingController, initialTakingState, type TakingState } from './taking-controller.js';

const noopSubscribe = () => () => {};
const EMPTY = initialTakingState();

/**
 * One TakingController per attempt, created in an effect (StrictMode mounts effects twice, and a disposed
 * controller must never be reused). Also wires the two window events the controller does not own:
 * coming back online retries failed saves; leaving with unsaved answers asks for confirmation.
 */
export function useTakingExam(attemptId: number, onChanged: () => Promise<void>): { state: TakingState; ctrl: TakingController | null } {
  const gateway = useExamGateway();
  const changed = useRef(onChanged);
  changed.current = onChanged; // always the latest, without recreating the controller
  const [ctrl, setCtrl] = useState<TakingController | null>(null);

  useEffect(() => {
    const c = new TakingController({ gateway, attemptId, onChanged: () => changed.current() });
    setCtrl(c);
    void c.load();
    const back = () => { void c.retrySave(); };
    const beforeUnload = (e: BeforeUnloadEvent) => { if (c.hasUnsavedWork()) e.preventDefault(); };
    window.addEventListener('online', back);
    window.addEventListener('beforeunload', beforeUnload);
    return () => { window.removeEventListener('online', back); window.removeEventListener('beforeunload', beforeUnload); c.dispose(); };
  }, [gateway, attemptId]);

  const state = useSyncExternalStore(ctrl ? ctrl.subscribe : noopSubscribe, ctrl ? ctrl.getState : () => EMPTY);
  return { state, ctrl };
}
