import { HttpAdminAuthGateway } from '../features/admin-auth/infrastructure/http-admin-auth-gateway.js';
import { HttpExamLibraryGateway } from '../features/exam-import/infrastructure/http-exam-library-gateway.js';
import { HttpMemberGateway } from '../features/member-join/infrastructure/http-member-gateway.js';
import { SessionStorageRoomCodeMemory } from '../features/member-join/infrastructure/session-storage-room-code-memory.js';
import { HttpReviewGateway } from '../features/member-review/infrastructure/http-review-gateway.js';
import { HttpMentorNoticesGateway } from '../features/mentor-notices/infrastructure/http-mentor-notices-gateway.js';
import { LocalStorageSeenStore } from '../features/mentor-notices/infrastructure/local-storage-seen-store.js';
import { HttpScreenGateway } from '../features/screen/infrastructure/http-screen-gateway.js';
import { HttpLeaderboardGateway } from '../shared/leaderboard/http-leaderboard-gateway.js';
import { HttpGradingGateway } from '../features/grading/infrastructure/http-grading-gateway.js';
import { HttpSessionAdminGateway } from '../features/session-admin/infrastructure/http-session-admin-gateway.js';
import { HttpDiscussionGateway } from '../features/discussion/infrastructure/http-discussion-gateway.js';
import { HttpExamGateway } from '../features/member-exam/infrastructure/http-exam-gateway.js';
import { createHttpClient } from '../shared/api-client/http-client.js';
import { participantAuth } from '../shared/api-client/participant-auth.js';
import { createSessionEventHub } from '../shared/events/sse-event-stream.js';
import { LocalStorageTokenStore } from '../shared/token-store/local-storage-token-store.js';

/**
 * Web composition root: the one place that picks implementations for the ports.
 *
 * Module-level singletons, not React context, on purpose: (1) the SSE hub must be one per tab (browsers allow
 * ~6 HTTP/1.1 connections per origin), which is a process-wide fact, not a tree-scoped one; (2) code that is not yet
 * migrated (pages/, lib/) imports these straight from here without a provider above it. Features receive their gateways through React
 * context (`AppProviders`), so their UI never imports infrastructure; tests build their own with fakes.
 */
export const tokenStore = new LocalStorageTokenStore();
export const api = createHttpClient({ interceptors: [participantAuth(tokenStore)] });
export const eventStream = createSessionEventHub();
export const examGateway = new HttpExamGateway(api);
export const discussionGateway = new HttpDiscussionGateway(api);
export const sessionAdminGateway = new HttpSessionAdminGateway(api);
export const gradingGateway = new HttpGradingGateway(api);
export const examLibraryGateway = new HttpExamLibraryGateway(api);
export const adminAuthGateway = new HttpAdminAuthGateway(api);
export const memberGateway = new HttpMemberGateway(api);
export const roomCodeMemory = new SessionStorageRoomCodeMemory();
export const reviewGateway = new HttpReviewGateway(api);
export const screenGateway = new HttpScreenGateway(api);
export const leaderboardGateway = new HttpLeaderboardGateway(api);
export const mentorNoticesGateway = new HttpMentorNoticesGateway(api);
export const seenStore = new LocalStorageSeenStore();
