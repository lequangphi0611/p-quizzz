import type { AdminStatus } from '../../../../shared/api/index.js';

/** Port: the mentor's session on this browser. Failures reject with `ApiError`. */
export interface AdminAuthGateway {
  getStatus(): Promise<AdminStatus>;
  login(password: string): Promise<void>;
  /** First run: sets the password and logs in. */
  setup(password: string): Promise<void>;
  logout(): Promise<void>;
}
