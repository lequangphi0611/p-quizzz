import { createContext, useContext, type ReactNode } from 'react';
import type { ExamGateway } from './exam-gateway.js';

const Ctx = createContext<ExamGateway | null>(null);

/** The composition root (`app/`) provides the implementation; the UI only sees the port. */
export const ExamGatewayProvider = ({ gateway, children }: { gateway: ExamGateway; children: ReactNode }) => <Ctx.Provider value={gateway}>{children}</Ctx.Provider>;

export function useExamGateway(): ExamGateway {
  const gateway = useContext(Ctx);
  if (!gateway) throw new Error('ExamGatewayProvider is missing above this component');
  return gateway;
}
