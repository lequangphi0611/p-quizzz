import { useEffect, useState, useSyncExternalStore } from 'react';
import type { TrainingDetail, TrainingSummary } from '../../../../shared/api/index.js';
import { saveBlobFile } from '../../../shared/download/save-blob-file.js';
import { saveTextFile } from '../../../shared/download/save-text-file.js';
import { useAdminEvents } from '../../../shared/events/use-session-events.js';
import { useTrainingAdminGateway } from './training-admin-context.js';
import { TrainingController, type TrainingState } from './training-controller.js';
import { TrainingListController, type TrainingListState } from './training-list-controller.js';

/** Slow safety net under the SSE signals (a signal can be lost, and a dead stream says nothing): every 15 s, every 5 s once a reload failed. */
const POLL_MS = 15_000;
const POLL_OFFLINE_MS = 5_000;

/**
 * One controller for the page's lifetime, seeded with what the route loader fetched. It reloads on the `training` signal of
 * this training, after the SSE stream reconnects, when the tab is shown again, and on a slow poll. A hidden tab skips the poll.
 */
export function useTraining(initial: TrainingDetail, initialMemberId: number | null): { state: TrainingState; ctrl: TrainingController } {
  const gateway = useTrainingAdminGateway();
  const [ctrl] = useState(() => new TrainingController(gateway, initial, { initialMemberId, saveFile: saveTextFile, saveBlob: saveBlobFile }));
  const state = useSyncExternalStore(ctrl.subscribe, ctrl.getState);
  useEffect(() => { ctrl.start(); }, [ctrl]);
  useAdminEvents({
    onEvent: () => {},
    onResync: () => { void ctrl.refresh(); },
    onTraining: id => { if (id === initial.id) void ctrl.refresh(); },
  });
  const ended = state.detail.status === 'ended';
  useEffect(() => {
    if (ended) return;
    const poll = () => { if (!document.hidden) void ctrl.refresh(); };
    const t = setInterval(poll, state.offline ? POLL_OFFLINE_MS : POLL_MS);
    document.addEventListener('visibilitychange', poll);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', poll); };
  }, [ctrl, ended, state.offline]);
  return { state, ctrl };
}

/** The list page: member counts move while a training is open, so it reloads on any `training` signal and after a reconnect. */
export function useTrainingList(initial: TrainingSummary[]): { state: TrainingListState; ctrl: TrainingListController } {
  const gateway = useTrainingAdminGateway();
  const [ctrl] = useState(() => new TrainingListController(gateway, initial));
  const state = useSyncExternalStore(ctrl.subscribe, ctrl.getState);
  useAdminEvents({ onEvent: () => {}, onResync: () => { void ctrl.refresh(); }, onTraining: () => { void ctrl.refresh(); } });
  return { state, ctrl };
}
