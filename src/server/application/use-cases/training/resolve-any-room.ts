import type { ActiveSessionView } from '../../ports/session-repository.js';
import type { TrainingReader } from '../../ports/training-repository.js';
import type { ResolveRoom } from '../sessions/resolve-room.js';
import { WrongRoomCodeError } from '../../../domain/participant/errors.js';

export type ResolvedRoomView = { kind: 'session'; session: ActiveSessionView } | { kind: 'training'; id: number; title: string };

/**
 * A room code leads to an open session or an open training: the two share one code space, so it is never both.
 * Anything else (unknown code, stopped training, closed session) is the same wrong-code error as before.
 */
export class ResolveAnyRoom {
  constructor(private readonly deps: { session: Pick<ResolveRoom, 'execute'>; trainings: Pick<TrainingReader, 'findOpenByRoomCode'> }) {}

  async execute(roomCode: string): Promise<ResolvedRoomView> {
    try {
      return { kind: 'session', session: await this.deps.session.execute(roomCode) };
    } catch (err) {
      if (!(err instanceof WrongRoomCodeError)) throw err;
    }
    const training = await this.deps.trainings.findOpenByRoomCode(roomCode);
    if (!training) throw new WrongRoomCodeError();
    return { kind: 'training', id: training.id, title: training.name };
  }
}
