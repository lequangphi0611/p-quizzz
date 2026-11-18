import type { ReactNode } from 'react';
import { AdminAuthGatewayContext } from '../features/admin-auth/application/admin-auth-context.js';
import { DiscussionGatewayContext } from '../features/discussion/application/use-discussion.js';
import { GroupsGatewayContext } from '../features/groups/application/groups-context.js';
import { ExamLibraryGatewayContext } from '../features/exam-import/application/exam-context.js';
import { GradingGatewayContext } from '../features/grading/application/grading-context.js';
import { ExamGatewayProvider } from '../features/member-exam/application/exam-gateway-context.js';
import { MemberServicesContext } from '../features/member-join/application/member-home-context.js';
import { ReviewGatewayContext } from '../features/member-review/application/use-review.js';
import { MentorNoticesServicesContext } from '../features/mentor-notices/application/use-mentor-notices.js';
import { ScreenGatewayContext } from '../features/screen/application/use-screen.js';
import { SessionAdminGatewayContext } from '../features/session-admin/application/session-admin-context.js';
import { EventStreamProvider } from '../shared/events/use-session-events.js';
import { LeaderboardGatewayContext } from '../shared/leaderboard/Leaderboard.js';
import { TokenStoreContext } from '../shared/token-store/token-store-context.js';
import * as c from './composition.js';

/** Hands the composition root's implementations to the features through React context (features never import infrastructure). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <EventStreamProvider stream={c.eventStream}>
      <TokenStoreContext.Provider value={c.tokenStore}>
        <LeaderboardGatewayContext.Provider value={c.leaderboardGateway}>
          <ExamGatewayProvider gateway={c.examGateway}>
            <DiscussionGatewayContext.Provider value={c.discussionGateway}>
              <SessionAdminGatewayContext.Provider value={c.sessionAdminGateway}>
                <GradingGatewayContext.Provider value={c.gradingGateway}>
                  <ExamLibraryGatewayContext.Provider value={c.examLibraryGateway}>
                    <GroupsGatewayContext.Provider value={c.groupsGateway}>
                    <AdminAuthGatewayContext.Provider value={c.adminAuthGateway}>
                      <MemberServicesContext.Provider value={{ gateway: c.memberGateway, rooms: c.roomCodeMemory, mine: c.mySessionsStore }}>
                        <ReviewGatewayContext.Provider value={c.reviewGateway}>
                          <ScreenGatewayContext.Provider value={c.screenGateway}>
                            <MentorNoticesServicesContext.Provider value={{ gateway: c.mentorNoticesGateway, seen: c.seenStore }}>{children}</MentorNoticesServicesContext.Provider>
                          </ScreenGatewayContext.Provider>
                        </ReviewGatewayContext.Provider>
                      </MemberServicesContext.Provider>
                    </AdminAuthGatewayContext.Provider>
                    </GroupsGatewayContext.Provider>
                  </ExamLibraryGatewayContext.Provider>
                </GradingGatewayContext.Provider>
              </SessionAdminGatewayContext.Provider>
            </DiscussionGatewayContext.Provider>
          </ExamGatewayProvider>
        </LeaderboardGatewayContext.Provider>
      </TokenStoreContext.Provider>
    </EventStreamProvider>
  );
}
