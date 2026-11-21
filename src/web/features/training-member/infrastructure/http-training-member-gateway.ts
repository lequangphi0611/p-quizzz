import { TRAINING_MEMBER_HEADER, type HookConfig, type JoinTrainingResponse, type MyTraining, type UninstallCheckResult } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { TrainingMemberGateway } from '../application/training-member-gateway.js';

const auth = (token: string) => ({ headers: { [TRAINING_MEMBER_HEADER]: token } });

export class HttpTrainingMemberGateway implements TrainingMemberGateway {
  constructor(private http: HttpClient) {}
  join(trainingId: number, input: { displayName: string; roomCode: string }): Promise<JoinTrainingResponse> {
    return this.http.post<JoinTrainingResponse>(`/api/trainings/${trainingId}/join`, { ...input, consent: true });
  }
  me(token: string): Promise<MyTraining> { return this.http.get<MyTraining>('/api/training/me', auth(token)); }
  hookConfig(token: string): Promise<HookConfig> { return this.http.get<HookConfig>('/api/training/me/hook-config', auth(token)); }
  async startUninstallCheck(token: string): Promise<void> { await this.http.post('/api/training/me/uninstall-check', undefined, auth(token)); }
  finishUninstallCheck(token: string): Promise<UninstallCheckResult> { return this.http.post<UninstallCheckResult>('/api/training/me/uninstall-check/finish', undefined, auth(token)); }
  async withdraw(token: string): Promise<void> { await this.http.delete('/api/training/me', undefined, auth(token)); }
}
