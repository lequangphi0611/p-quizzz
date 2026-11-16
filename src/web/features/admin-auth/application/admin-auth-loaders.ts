import { redirect } from 'react-router';
import type { AdminStatus } from '../../../../shared/api/index.js';
import type { AdminAuthGateway } from './admin-auth-gateway.js';

/** Route guards bound to a gateway by the composition root. The server enforces auth too (requireMentor). */
export function createAdminAuthLoaders(gateway: AdminAuthGateway) {
  return {
    /** Every /admin/* page except login needs a mentor session. */
    async requireLogin(): Promise<null> {
      if (!(await gateway.getStatus()).loggedIn) throw redirect('/admin/login');
      return null;
    },
    async login(): Promise<AdminStatus> {
      const s = await gateway.getStatus();
      if (s.loggedIn) throw redirect('/admin/exams');
      return s;
    },
  };
}
