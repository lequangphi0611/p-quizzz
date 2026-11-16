import { ExamNotFoundError } from '../../../domain/exam/errors.js';
import type { SessionModeId } from '../../../domain/session/mode.js';
import type { SessionModeRegistry } from '../../../domain/session/mode.js';
import type { Clock } from '../../ports/clock.js';
import type { SessionDetailView, SessionReader, SessionUnitContext } from '../../ports/session-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import { resolveSessionName } from '../../../domain/session/session-name.js';

export interface CreateSessionInput {
  examId: number;
  /** Mentor-only label; blank or missing gives "<exam title> – dd/MM". */
  name?: string;
  shuffle?: boolean;
  autoApprove?: boolean;
  /** Only `self_paced` exists today; the API does not expose this yet. */
  mode?: SessionModeId;
}

export class CreateSession {
  constructor(
    private readonly deps: { unitOfWork: UnitOfWork<SessionUnitContext>; sessions: SessionReader; clock: Clock; modes: SessionModeRegistry },
  ) {}

  async execute(input: CreateSessionInput): Promise<SessionDetailView> {
    const mode = this.deps.modes.get(input.mode ?? 'self_paced');
    const id = await this.deps.unitOfWork.run(async ctx => {
      const exam = await ctx.exams.findSummary(input.examId);
      if (!exam) throw new ExamNotFoundError();
      const now = this.deps.clock.now();
      return ctx.sessions.create({
        examId: input.examId,
        name: resolveSessionName(input.name, exam.title, now),
        mode: mode.id,
        shuffle: input.shuffle ?? true,
        autoApprove: input.autoApprove ?? false,
        createdAt: now,
      });
    });
    const detail = await this.deps.sessions.findDetail(id);
    if (!detail) throw new SessionNotFoundError();
    return detail;
  }
}
