import type { SessionReader } from '../../ports/session-repository.js';

/** The projector shows the room code of the active session. Only the mentor's machine may ask: the route enforces it. */
export class GetProjectorRoom {
  constructor(private readonly sessions: Pick<SessionReader, 'findActiveRoomCode'>) {}

  async execute(): Promise<{ roomCode: string | null }> {
    return { roomCode: await this.sessions.findActiveRoomCode() };
  }
}
