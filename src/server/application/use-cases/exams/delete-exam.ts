import { ExamInUseError, ExamNotFoundError } from '../../../domain/exam/errors.js';
import type { ExamUnitContext } from '../../ports/exam-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

/** Deletes an exam that no session has used. The check and the delete are one unit, so a session cannot slip in between. */
export class DeleteExam {
  constructor(private readonly unitOfWork: UnitOfWork<ExamUnitContext>) {}

  execute(id: number): Promise<void> {
    return this.unitOfWork.run(async ({ exams }) => {
      const summary = await exams.findSummary(id);
      if (!summary) throw new ExamNotFoundError();
      if (summary.sessionCount > 0) throw new ExamInUseError();
      await exams.remove(id);
    });
  }
}
