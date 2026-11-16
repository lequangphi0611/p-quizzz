import type { AdminStatus } from '../../../../shared/api/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { AdminAuthGateway } from '../application/admin-auth-gateway.js';

export class HttpAdminAuthGateway implements AdminAuthGateway {
  constructor(private http: HttpClient) {}
  getStatus(): Promise<AdminStatus> { return this.http.get<AdminStatus>('/api/admin/status'); }
  async login(password: string): Promise<void> { await this.http.post('/api/admin/login', { password }); }
  async setup(password: string): Promise<void> { await this.http.post('/api/admin/setup', { password }); }
  async logout(): Promise<void> { await this.http.post('/api/admin/logout'); }
}
