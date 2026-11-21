import type { TrainingStatus } from '../../../../shared/api/index.js';

export const trainingStatusLabel = (status: TrainingStatus): string => ({ open: 'Đang thu', stopped: 'Đã dừng thu', ended: 'Đã kết thúc' })[status];

/** Icon next to the status word: the word and the icon carry the state, the colour only supports it. */
export const trainingStatusIcon = (status: TrainingStatus): string => ({ open: 'circle-dot', stopped: 'square', ended: 'lock' })[status];

export const trainingStatusTone = (status: TrainingStatus): 'live' | 'paused' | 'done' => ({ open: 'live', stopped: 'paused', ended: 'done' } as const)[status];

export const memberCountLabel = (n: number): string => `${n} người`;
