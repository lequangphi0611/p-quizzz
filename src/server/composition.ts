import type { ExamUnitContext } from './application/ports/exam-repository.js';
import { DeleteExam } from './application/use-cases/exams/delete-exam.js';
import { GetExam } from './application/use-cases/exams/get-exam.js';
import { ImportExam } from './application/use-cases/exams/import-exam.js';
import { ListExams } from './application/use-cases/exams/list-exams.js';
import { PreviewExam } from './application/use-cases/exams/preview-exam.js';
import type { Db } from './db/client.js';
import { DrizzleExamRepository } from './infrastructure/db/drizzle-exam-repository.js';
import { SqliteDatabase, SqliteUnitOfWork } from './infrastructure/db/sqlite-database.js';
import type { ExamUseCases } from './interface/http/exams-routes.js';

/** Everything the HTTP layer needs from the application. Grows as modules move to Clean Architecture. */
export interface Composition {
  exams: ExamUseCases;
}

// Composition root: the one place that knows which implementation backs each port. Wired by hand.
export function compose(db: Db): Composition {
  const database = new SqliteDatabase(db);

  const examReader = new DrizzleExamRepository(fn => database.read(fn));
  const examUnitOfWork = new SqliteUnitOfWork<ExamUnitContext>(database, tx => ({
    exams: new DrizzleExamRepository(async fn => fn(tx)),
  }));

  return {
    exams: {
      preview: new PreviewExam(),
      importExam: new ImportExam({ unitOfWork: examUnitOfWork, exams: examReader, now: () => new Date() }),
      list: new ListExams(examReader),
      get: new GetExam(examReader),
      remove: new DeleteExam(examUnitOfWork),
    },
  };
}
