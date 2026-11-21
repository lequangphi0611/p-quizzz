import type { CreatedTraining, NetworkInfo, TrainingDetail, TrainingEventDetail, TrainingEventsPage, TrainingSummary } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { TrainingAdminGateway } from '../application/training-admin-gateway.js';

/** localStorage key of the "ẩn nội dung" choice; mentor browser only. */
export const HIDE_CONTENT_KEY = 'pq:training-admin:hide-content';

/** The browser's localStorage, or null when it is not there or access throws (private window, blocked site data). */
const defaultStorage = (): Pick<Storage, 'getItem' | 'setItem'> | null => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

export class HttpTrainingAdminGateway implements TrainingAdminGateway {
  constructor(private http: HttpClient, private storage: Pick<Storage, 'getItem' | 'setItem'> | null = defaultStorage()) {}
  list(): Promise<TrainingSummary[]> { return this.http.get<TrainingSummary[]>('/api/admin/trainings'); }
  create(name: string, options: { allowAutoAccept?: boolean } = {}): Promise<CreatedTraining> {
    return this.http.post<CreatedTraining>('/api/admin/trainings', { name, allowAutoAccept: options.allowAutoAccept ?? false });
  }
  get(id: number): Promise<TrainingDetail> { return this.http.get<TrainingDetail>(`/api/admin/trainings/${id}`); }
  stop(id: number): Promise<TrainingDetail> { return this.http.post<TrainingDetail>(`/api/admin/trainings/${id}/stop`); }
  end(id: number): Promise<TrainingDetail> { return this.http.post<TrainingDetail>(`/api/admin/trainings/${id}/end`); }
  async purgeMember(trainingId: number, memberId: number): Promise<void> { await this.http.post(`/api/admin/trainings/${trainingId}/members/${memberId}/purge`); }
  async removeMember(trainingId: number, memberId: number): Promise<void> { await this.http.delete(`/api/admin/trainings/${trainingId}/members/${memberId}`); }
  events(trainingId: number, memberId: number, after = 0): Promise<TrainingEventsPage> {
    return this.http.get<TrainingEventsPage>(`/api/admin/trainings/${trainingId}/members/${memberId}/events${after > 0 ? `?after=${after}` : ''}`);
  }
  eventDetail(trainingId: number, eventId: number): Promise<TrainingEventDetail> { return this.http.get<TrainingEventDetail>(`/api/admin/trainings/${trainingId}/events/${eventId}/detail`); }
  async mark(trainingId: number, eventId: number, marked: boolean): Promise<void> {
    const path = `/api/admin/trainings/${trainingId}/events/${eventId}/mark`;
    await (marked ? this.http.put(path) : this.http.delete(path));
  }
  async saveNote(trainingId: number, memberId: number, note: string): Promise<void> { await this.http.put(`/api/admin/trainings/${trainingId}/members/${memberId}/note`, { note }); }
  reportPreview(trainingId: number): Promise<string> { return this.http.get<string>(`/api/admin/trainings/${trainingId}/report.md?preview=1`, { as: 'text' }); }
  exportReport(trainingId: number): Promise<string> { return this.http.get<string>(`/api/admin/trainings/${trainingId}/report.md`, { as: 'text' }); }
  async getJoinHosts(): Promise<string[]> { return (await this.http.get<NetworkInfo>('/api/network')).joinHosts; }
  readHideContent(): boolean {
    try { return this.storage?.getItem(HIDE_CONTENT_KEY) === '1'; } catch { return false; }
  }
  writeHideContent(hide: boolean): void {
    try { this.storage?.setItem(HIDE_CONTENT_KEY, hide ? '1' : '0'); } catch { /* not remembered; the page still works */ }
  }
}
