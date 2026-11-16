import type { ReactNode } from 'react';
import { DiscussionGatewayContext } from '../features/discussion/application/use-discussion.js';
import { GradingGatewayContext } from '../features/grading/application/grading-context.js';
import { SessionAdminGatewayContext } from '../features/session-admin/application/session-admin-context.js';
import { ExamGatewayProvider } from '../features/member-exam/application/exam-gateway-context.js';
import { EventStreamProvider } from '../shared/events/use-session-events.js';
import { discussionGateway, eventStream, examGateway, gradingGateway, sessionAdminGateway } from './composition.js';

/** Hands the composition root's implementations to the features through React context. */
export const AppProviders = ({ children }: { children: ReactNode }) => (
  <EventStreamProvider stream={eventStream}>
    <ExamGatewayProvider gateway={examGateway}>
      <DiscussionGatewayContext.Provider value={discussionGateway}>
        <SessionAdminGatewayContext.Provider value={sessionAdminGateway}>
          <GradingGatewayContext.Provider value={gradingGateway}>{children}</GradingGatewayContext.Provider>
        </SessionAdminGatewayContext.Provider>
      </DiscussionGatewayContext.Provider>
    </ExamGatewayProvider>
  </EventStreamProvider>
);
