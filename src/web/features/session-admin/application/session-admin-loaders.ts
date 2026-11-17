import type { ExamSummary, GroupSummary, LeaderboardResponse, SessionDetail, SessionSummary } from '../../../../shared/api/index.js';
import type { SessionAdminGateway } from './session-admin-gateway.js';

type Args = { params: { id?: string } };

export interface SessionListData { sessions: SessionSummary[]; exams: ExamSummary[]; groups: GroupSummary[] }
export interface SessionReviewData { session: SessionDetail; board: LeaderboardResponse }

/** react-router loaders of the mentor session routes, bound to a gateway by the composition root. */
export function createSessionAdminLoaders(gateway: SessionAdminGateway) {
  return {
    list: async (): Promise<SessionListData> => {
      const [sessions, exams, groups] = await Promise.all([gateway.listSessions(), gateway.listExams(), gateway.listGroups()]);
      return { sessions, exams, groups };
    },
    detail: ({ params }: Args): Promise<SessionDetail> => gateway.getSession(Number(params.id)),
    review: async ({ params }: Args): Promise<SessionReviewData> => {
      const id = Number(params.id);
      const [session, board] = await Promise.all([gateway.getSession(id), gateway.getLeaderboard(id)]);
      return { session, board };
    },
  };
}
