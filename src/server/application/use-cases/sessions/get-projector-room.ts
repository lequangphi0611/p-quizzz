import type { SessionReader } from '../../ports/session-repository.js';

/** The projector shows the room code of one open session. Only the mentor's machine may ask: the route enforces it. */
export class GetProjectorRoom {
  constructor(private readonly sessions: Pick<SessionReader, 'findOpenRoomCode'>) {}

  async execute(sessionId: number): Promise<{ roomCode: string | null }> {
    return { roomCode: await this.sessions.findOpenRoomCode(sessionId) };
  }
}
