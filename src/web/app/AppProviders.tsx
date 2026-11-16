import type { ReactNode } from 'react';
import { DiscussionGatewayContext } from '../features/discussion/application/use-discussion.js';
import { ExamGatewayProvider } from '../features/member-exam/application/exam-gateway-context.js';
import { discussionGateway, examGateway } from './composition.js';

/** Hands the composition root's implementations to the features through React context. */
export const AppProviders = ({ children }: { children: ReactNode }) => (
  <ExamGatewayProvider gateway={examGateway}>
    <DiscussionGatewayContext.Provider value={discussionGateway}>{children}</DiscussionGatewayContext.Provider>
  </ExamGatewayProvider>
);
