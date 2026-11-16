import type { ReactNode } from 'react';
import { ExamGatewayProvider } from '../features/member-exam/application/exam-gateway-context.js';
import { examGateway } from './composition.js';

/** Hands the composition root's implementations to the features through React context. */
export const AppProviders = ({ children }: { children: ReactNode }) => <ExamGatewayProvider gateway={examGateway}>{children}</ExamGatewayProvider>;
