import { WrongRoomCodeError } from '../../../domain/participant/errors.js';
import type { ActiveSessionView, SessionReader } from '../../ports/session-repository.js';

/**
 * Members find their session by the room code (several sessions may be open at once, PRODUCT.md §7.5).
 * An unknown code and a session that is not open look the same: a closed session must not be discoverable.
 */
export class ResolveRoom {
  constructor(private readonly sessions: Pick<SessionReader, 'findOpenByRoomCode'>) {}

  async execute(roomCode: string): Promise<ActiveSessionView> {
    const found = await this.sessions.findOpenByRoomCode(roomCode);
    if (!found) throw new WrongRoomCodeError();
    return found;
  }
}
