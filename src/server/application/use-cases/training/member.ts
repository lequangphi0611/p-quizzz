import { WrongRoomCodeError } from '../../../domain/participant/errors.js';
import { TrainingNotJoinedError, TrainingStateError } from '../../../domain/training/errors.js';
import { buildHookSettings, buildMergePrompt } from '../../../domain/training/hook-settings.js';
import { assertTrainingNameFree, connectionState, uninstallCheckState, type Training, type TrainingMember } from '../../../domain/training/training.js';
import { roomCodeMatches } from '../../../domain/session/room-code.js';
import type { HookConfig } from '../../../../shared/api/training.js';
import type { Clock } from '../../ports/clock.js';
import type { TokenGenerator } from '../../ports/token-generator.js';
import type { TrainingMemberReader, TrainingReader, TrainingUnitContext } from '../../ports/training-repository.js';
import type { TrainingSignals } from '../../ports/training-signals.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

/** Who is behind a member token, and which training they are in. */
export interface TrainingMemberContext {
  member: TrainingMember;
  training: Training;
}

/**
 * A member joins an open training with its code and a name, and only after agreeing (the route refuses without `consent: true`).
 * A training that is not open looks exactly like a wrong code (one neutral 403), so a stopped one is not discoverable.
 */
export class JoinTraining {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<TrainingUnitContext>; clock: Clock; tokens: TokenGenerator; signals: TrainingSignals }) {}

  async execute(input: { trainingId: number; displayName: string; roomCode: string }): Promise<{ token: string; member: TrainingMember }> {
    const token = this.deps.tokens.generate();
    const ingestToken = this.deps.tokens.generate();
    const member = await this.deps.unitOfWork.run(async ({ trainings, members }) => {
      const training = await trainings.findById(input.trainingId);
      if (!training || training.status !== 'open' || !training.roomCode || !roomCodeMatches(training.roomCode, input.roomCode)) throw new WrongRoomCodeError();
      assertTrainingNameFree(await members.listByTraining(training.id), input.displayName);
      return members.add({ trainingId: training.id, displayName: input.displayName, token, ingestToken, consentedAt: this.deps.clock.now() });
    });
    await this.deps.signals.signal(input.trainingId);
    return { token, member };
  }
}

/** Resolves the member from the browser token (every `/api/training/me` request). Unknown token → 401. */
export class ResumeTrainingMember {
  constructor(private readonly deps: { members: TrainingMemberReader; trainings: TrainingReader }) {}

  async execute(token: string | undefined): Promise<TrainingMemberContext> {
    const member = token ? await this.deps.members.findByToken(token) : null;
    const training = member ? await this.deps.trainings.findById(member.trainingId) : null;
    if (!member || !training) throw new TrainingNotJoinedError();
    return { member, training };
  }
}

/** Status only: never anything that was collected, and never the ingest token. */
export class GetMyTraining {
  execute({ member, training }: TrainingMemberContext) {
    return {
      training: { id: training.id, name: training.name, status: training.status },
      member: { displayName: member.displayName, connection: connectionState(member), uninstallCheck: uninstallCheckState(member) },
    };
  }
}

/** The settings (and the ready-made request) the member merges into the exercise folder. Only while the training is open. */
export class GetHookConfig {
  execute({ member, training }: TrainingMemberContext, baseUrl: string): HookConfig {
    if (training.status !== 'open') throw new TrainingStateError('Buổi training không còn thu nữa, không cần cài thêm');
    const settings = buildHookSettings(baseUrl, member.ingestToken);
    return { settings, mergePrompt: buildMergePrompt(settings) };
  }
}

/** The member withdraws consent: they and everything collected from them are deleted. */
export class WithdrawTrainingConsent {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<TrainingUnitContext>; signals: TrainingSignals }) {}

  async execute({ member, training }: TrainingMemberContext): Promise<void> {
    await this.deps.unitOfWork.run(({ members }) => members.delete(member.id));
    await this.deps.signals.signal(training.id);
  }
}
