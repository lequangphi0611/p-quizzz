import type { FastifyPluginAsync } from 'fastify';
import type { ScreenRoom, ScreenSessions } from '../../../shared/api/index.js';
import { SessionNotFoundError } from '../../domain/session/errors.js';
import type { GetProjectorRoom } from '../../application/use-cases/sessions/get-projector-room.js';
import type { ListScreenSessions } from '../../application/use-cases/sessions/list-screen-sessions.js';
import { requireLocal } from './auth/require-local.js';
import { sendDomainError } from './domain-errors.js';
import { parseId } from './params.js';
import { toScreenSessionDto } from './presenters/session-presenter.js';

// The projector runs on the mentor's machine. Two things must stay off the LAN: the room code (anyone who sees it
// can join) and the mentor's session names (they may name a group). Both come from these routes, which only answer on
// the mentor's machine (loopback or its own address) and ignore --allow-remote-admin: that flag must never publish them.
export const screenRoutes = (uc: { projectorRoom: GetProjectorRoom; screenSessions: ListScreenSessions }): FastifyPluginAsync =>
  async app => {
    app.get('/api/screen/sessions', { onRequest: requireLocal(false) }, async (): Promise<ScreenSessions> => {
      const { open, latestEnded } = await uc.screenSessions.execute();
      return { open: open.map(toScreenSessionDto), latestEnded: latestEnded ? toScreenSessionDto(latestEnded) : null };
    });

    app.get<{ Params: { id: string } }>('/api/screen/sessions/:id/room', { onRequest: requireLocal(false) }, async (req, reply): Promise<ScreenRoom | undefined> => {
      try {
        const id = parseId(req.params.id);
        if (!id) throw new SessionNotFoundError();
        return await uc.projectorRoom.execute(id);
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });
  };
