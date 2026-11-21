import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTrainingMemberServices } from './training-member-context.js';
import { TrainingMemberController, type TrainingMemberState } from './training-member-controller.js';

/**
 * One controller for the page's lifetime: it polls while mounted and catches up when the tab is shown again.
 * Created once per (training, room code); the page keys its inner component on the training id.
 */
export function useTrainingMember(trainingId: number, roomCode: string): { state: TrainingMemberState; ctrl: TrainingMemberController } {
  const { gateway, tokens } = useTrainingMemberServices();
  const [ctrl] = useState(() => new TrainingMemberController({ gateway, tokens }, trainingId, roomCode));
  const state = useSyncExternalStore(ctrl.subscribe, ctrl.getState);
  useEffect(() => ctrl.start(), [ctrl]);
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) void ctrl.refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [ctrl]);
  return { state, ctrl };
}

/** `Date.now()` re-read every `everyMs` while `active`, for countdowns and "after a minute" hints that only exist on screen. */
export function useNow(active: boolean, everyMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [active, everyMs]);
  return now;
}
