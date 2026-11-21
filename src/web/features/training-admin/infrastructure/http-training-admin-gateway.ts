import type { CreatedTraining, NetworkInfo, TrainingDetail, TrainingEventDetail, TrainingEventsPage, TrainingSummary } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { TrainingAdminGateway } from '../application/training-admin-gateway.js';

export class HttpTrainingAdminGateway implements TrainingAdminGateway {
  constructor(private http: HttpClient) {}
  list(): Promise<TrainingSummary[]> { return this.http.get<TrainingSummary[]>('/api/admin/trainings'); }
  create(name: string): Promise<CreatedTraining> { return this.http.post<CreatedTraining>('/api/admin/trainings', { name }); }
  get(id: number): Promise<TrainingDetail> { return this.http.get<TrainingDetail>(`/api/admin/trainings/${id}`); }
  stop(id: number): Promise<TrainingDetail> { return this.http.post<TrainingDetail>(`/api/admin/trainings/${id}/stop`); }
  end(id: number): Promise<TrainingDetail> { return this.http.post<TrainingDetail>(`/api/admin/trainings/${id}/end`); }
  async removeMember(trainingId: number, memberId: number): Promise<void> { await this.http.delete(`/api/admin/trainings/${trainingId}/members/${memberId}`); }
  events(trainingId: number, memberId: number, after = 0): Promise<TrainingEventsPage> {
    return this.http.get<TrainingEventsPage>(`/api/admin/trainings/${trainingId}/members/${memberId}/events${after > 0 ? `?after=${after}` : ''}`);
  }
  eventDetail(trainingId: number, eventId: number): Promise<TrainingEventDetail> { return this.http.get<TrainingEventDetail>(`/api/admin/trainings/${trainingId}/events/${eventId}/detail`); }
  async getJoinHosts(): Promise<string[]> { return (await this.http.get<NetworkInfo>('/api/network')).joinHosts; }
}
