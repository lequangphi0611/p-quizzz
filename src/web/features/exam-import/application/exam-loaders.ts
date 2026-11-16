import type { ExamDetail, ExamSummary } from '../../../../shared/api/index.js';
import type { ExamLibraryGateway } from './exam-gateway.js';

/** react-router loaders of the exam routes, bound to a gateway by the composition root. */
export const createExamLoaders = (gateway: ExamLibraryGateway) => ({
  list: (): Promise<ExamSummary[]> => gateway.listExams(),
  detail: ({ params }: { params: { id?: string } }): Promise<ExamDetail> => gateway.getExam(Number(params.id)),
});
