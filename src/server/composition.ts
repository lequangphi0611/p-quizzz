import type { Clock } from './application/ports/clock.js';
import type { EventPublisher } from './application/ports/event-publisher.js';
import type { ExamUnitContext } from './application/ports/exam-repository.js';
import type { Random } from './application/ports/random.js';
import type { TokenGenerator } from './application/ports/token-generator.js';
import { DeleteExam } from './application/use-cases/exams/delete-exam.js';
import { GetExam } from './application/use-cases/exams/get-exam.js';
import { ImportExam } from './application/use-cases/exams/import-exam.js';
import { ListExams } from './application/use-cases/exams/list-exams.js';
import { PreviewExam } from './application/use-cases/exams/preview-exam.js';
import type { Db } from './db/client.js';
import { bus } from './events.js';
import { DrizzleExamRepository } from './infrastructure/db/drizzle-exam-repository.js';
import { SqliteDatabase, SqliteUnitOfWork } from './infrastructure/db/sqlite-database.js';
import { BusEventPublisher } from './infrastructure/events/bus-event-publisher.js';
import { CryptoRandom } from './infrastructure/system/crypto-random.js';
import { SecureTokenGenerator } from './infrastructure/system/secure-token-generator.js';
import { SystemClock } from './infrastructure/system/system-clock.js';
import type { ExamUseCases } from './interface/http/exams-routes.js';

/** Ports every module shares. Tests pass fakes for any of them (see `application/testing`). */
export interface SharedPorts {
  clock: Clock;
  tokens: TokenGenerator;
  random: Random;
  events: EventPublisher;
}

/** Everything the HTTP layer needs from the application. Grows as modules move to Clean Architecture. */
export interface Composition {
  exams: ExamUseCases;
}

// Composition root: the one place that knows which implementation backs each port. Wired by hand.
export function compose(db: Db, overrides: Partial<SharedPorts> = {}): Composition {
  const ports: SharedPorts = {
    clock: new SystemClock(),
    tokens: new SecureTokenGenerator(),
    random: new CryptoRandom(),
    // The same process-wide bus the SSE route subscribes to, so published events reach connected clients.
    events: new BusEventPublisher(bus),
    ...overrides,
  };
  const database = new SqliteDatabase(db);

  const examReader = new DrizzleExamRepository(fn => database.read(fn));
  const examUnitOfWork = new SqliteUnitOfWork<ExamUnitContext>(database, tx => ({
    exams: new DrizzleExamRepository(async fn => fn(tx)),
  }));

  return {
    exams: {
      preview: new PreviewExam(),
      importExam: new ImportExam({ unitOfWork: examUnitOfWork, exams: examReader, clock: ports.clock }),
      list: new ListExams(examReader),
      get: new GetExam(examReader),
      remove: new DeleteExam(examUnitOfWork),
    },
  };
}
