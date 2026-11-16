import type { GroupDetail, GroupSummary } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { GroupsGateway } from '../application/groups-gateway.js';

export class HttpGroupsGateway implements GroupsGateway {
  constructor(private http: HttpClient) {}
  list(): Promise<GroupSummary[]> { return this.http.get<GroupSummary[]>('/api/admin/groups'); }
  get(id: number): Promise<GroupDetail> { return this.http.get<GroupDetail>(`/api/admin/groups/${id}`); }
  create(input: { name: string; emails: string[] }): Promise<GroupDetail> { return this.http.post<GroupDetail>('/api/admin/groups', input); }
  update(id: number, input: { name: string; emails: string[] }): Promise<GroupDetail> { return this.http.put<GroupDetail>(`/api/admin/groups/${id}`, input); }
  async remove(id: number): Promise<void> { await this.http.delete(`/api/admin/groups/${id}`); }
}
