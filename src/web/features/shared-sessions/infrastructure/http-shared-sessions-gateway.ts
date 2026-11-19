import type { SharedSessionList, SharedSessionView } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { SharedSessionsGateway } from '../application/shared-sessions-gateway.js';

export class HttpSharedSessionsGateway implements SharedSessionsGateway {
  constructor(private http: HttpClient) {}
  list(token: string): Promise<SharedSessionList> { return this.http.get<SharedSessionList>(`/api/shared/${encodeURIComponent(token)}/sessions`); }
  get(token: string, sessionId: number): Promise<SharedSessionView> { return this.http.get<SharedSessionView>(`/api/shared/${encodeURIComponent(token)}/sessions/${sessionId}`); }
}
