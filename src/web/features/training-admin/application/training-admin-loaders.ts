import type { TrainingDetail, TrainingSummary } from '../../../../shared/api/index.js';
import type { TrainingAdminGateway } from './training-admin-gateway.js';

/** react-router loaders of the mentor's training routes, bound to a gateway by the composition root. */
export const createTrainingAdminLoaders = (gateway: TrainingAdminGateway) => ({
  list: (): Promise<TrainingSummary[]> => gateway.list(),
  detail: ({ params }: { params: { id?: string } }): Promise<TrainingDetail> => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new Response('Not found', { status: 404 });
    return gateway.get(id);
  },
});
