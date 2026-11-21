import { WrongRoomCodeError } from '../../../domain/participant/errors.js';
import { TrainingNotJoinedError, TrainingStateError } from '../../../domain/training/errors.js';
import { buildHookSettings, buildMergePrompt } from '../../../domain/training/hook-settings.js';
import { assertCanStopSending, assertTrainingNameFree, connectionState, uninstallCheckState, uninstallCheckVerdict, type Training, type TrainingMember } from '../../../domain/training/training.js';
import { roomCodeMatches } from '../../../domain/session/room-code.js';
import type { HookConfig, UninstallCheckResult } from '../../../../shared/api/training.js';
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

/**
 * The member's "Dừng gửi" (PRODUCT.md §7.34b, §7.35j): from now on nothing new is accepted from them, but what was already
 * collected stays until the mentor approves deleting it (`PurgeTrainingMember`) or ends the training. Only while the training
 * is open; once it is stopped there is nothing left to stop (409). Asking twice keeps the first time.
 */
export class WithdrawTrainingConsent {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<TrainingUnitContext>; clock: Clock; signals: TrainingSignals }) {}

  async execute({ member, training }: TrainingMemberContext): Promise<void> {
    assertCanStopSending(training);
    await this.deps.unitOfWork.run(({ members }) => members.stopSending(member.id, this.deps.clock.now()));
    await this.deps.signals.signal(training.id);
  }
}

/** The member says they removed the hook: from now on any event that still arrives proves they did not. Only once stopped. */
export class StartUninstallCheck {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<TrainingUnitContext>; clock: Clock }) {}

  async execute({ member, training }: TrainingMemberContext): Promise<void> {
    if (training.status !== 'stopped') throw new TrainingStateError('Chỉ kiểm tra gỡ được sau khi mentor dừng thu');
    await this.deps.unitOfWork.run(({ members }) => members.startUninstallCheck(member.id, this.deps.clock.now()));
  }
}

/** The verdict: quiet since the check began → passed (and the mentor's board shows it), else failed. Asked too early → 409. */
export class FinishUninstallCheck {
  constructor(private readonly deps: { unitOfWork: UnitOfWork<TrainingUnitContext>; clock: Clock; signals: TrainingSignals }) {}

  async execute({ member, training }: TrainingMemberContext): Promise<UninstallCheckResult> {
    if (training.status !== 'stopped') throw new TrainingStateError('Chỉ kiểm tra gỡ được sau khi mentor dừng thu');
    const now = this.deps.clock.now();
    const result = uninstallCheckVerdict(member, now);
    if (result === 'passed') {
      await this.deps.unitOfWork.run(({ members }) => members.finishUninstall(member.id, now));
      await this.deps.signals.signal(training.id);
    }
    return { result };
  }
}
