import type { GradingView, SessionDetail } from '../../../../shared/api/index.js';
import type { GradingGateway } from './grading-gateway.js';

export interface GradingData { grading: GradingView; session: SessionDetail }

/** react-router loader for `/admin/sessions/:id/grading`, bound to a gateway by the composition root. */
export const createGradingLoader = (gateway: GradingGateway) => async ({ params }: { params: { id?: string } }): Promise<GradingData> => {
  const id = Number(params.id);
  const [grading, session] = await Promise.all([gateway.getGrading(id), gateway.getSession(id)]);
  return { grading, session };
};
