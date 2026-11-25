import type { HookConfig, JoinTrainingResponse, MyTraining, ResolvedRoom, UninstallCheckResult } from '../../../../shared/api/index.js';

/** Port: what a member of an AI training may do. The member's token is passed on every call after `join`. Nothing here returns what was collected. */
export interface TrainingMemberGateway {
  /** What a room code opens (shared with exam sessions; 403 wrong code or not open, 429 too many wrong codes). Gives the consent screen the training's title. */
  resolveRoom(roomCode: string): Promise<ResolvedRoom>;
  /** Joins with the room code; `consent` is always `true` (the server refuses anything else); `teachingConsent` is the separate optional tick (S44), false when absent. */
  join(trainingId: number, input: { displayName: string; roomCode: string; teachingConsent?: boolean }): Promise<JoinTrainingResponse>;
  me(token: string): Promise<MyTraining>;
  /** Only while the training is open. */
  hookConfig(token: string): Promise<HookConfig>;
  startUninstallCheck(token: string): Promise<void>;
  finishUninstallCheck(token: string): Promise<UninstallCheckResult>;
  /** Withdraws consent: the member and everything collected from them are deleted. */
  withdraw(token: string): Promise<void>;
}

/** Port: where the member's token for a training is kept in this browser (`pq:training:<id>`). */
export interface TrainingTokenStore {
  get(trainingId: number): string | null;
  set(trainingId: number, token: string): void;
  clear(trainingId: number): void;
}
