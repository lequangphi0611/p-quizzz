import { createContext, useContext } from 'react';
import type { AdminAuthGateway } from './admin-auth-gateway.js';

export const AdminAuthGatewayContext = createContext<AdminAuthGateway | null>(null);

export function useAdminAuthGateway(): AdminAuthGateway {
  const g = useContext(AdminAuthGatewayContext);
  if (!g) throw new Error('AdminAuthGatewayContext.Provider is missing above this component');
  return g;
}
