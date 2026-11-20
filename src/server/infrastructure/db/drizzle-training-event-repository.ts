import type { NewTrainingEvent, TrainingEventRepository } from '../../application/ports/training-event-repository.js';
import type { DbAccess } from './drizzle-exam-repository.js';
import { trainingEvents } from './schema.js';

export class DrizzleTrainingEventRepository implements TrainingEventRepository {
  constructor(private readonly access: DbAccess) {}

  async append(event: NewTrainingEvent): Promise<void> {
    const common = { memberId: event.memberId, claudeSessionId: event.claudeSessionId, receivedAt: event.receivedAt };
    const row =
      event.kind === 'prompt'
        ? { ...common, kind: 'prompt' as const, prompt: event.prompt }
        : {
            ...common,
            kind: 'tool' as const,
            toolName: event.toolName,
            toolTarget: event.toolTarget,
            ok: event.ok,
            durationMs: event.durationMs,
            errorExcerpt: event.errorExcerpt,
            outputHead: event.output?.head ?? null,
            outputTail: event.output?.tail ?? null,
            outputOmittedLines: event.output?.omittedLines ?? null,
            changeHead: event.change?.head ?? null,
            changeTail: event.change?.tail ?? null,
            changeOmittedLines: event.change?.omittedLines ?? null,
          };
    await this.access(db => db.insert(trainingEvents).values(row).run());
  }
}
