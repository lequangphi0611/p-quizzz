import type { FastifyPluginAsync } from 'fastify';
import type { ScreenRoom } from '../../../shared/api/index.js';
import type { GetProjectorRoom } from '../../application/use-cases/sessions/get-projector-room.js';
import { requireLocal } from './auth/require-local.js';

// GET /api/screen/room: the projector shows the room code. Anyone on the LAN can read /api/sessions/latest, so the
// code is NOT there; it comes from this route, which only answers on the mentor's machine (loopback or its own
// address) and ignores --allow-remote-admin: that flag must never publish the code.
export const screenRoutes = (uc: { projectorRoom: GetProjectorRoom }): FastifyPluginAsync =>
  async app => {
    app.get('/api/screen/room', { onRequest: requireLocal(false) }, async (): Promise<ScreenRoom> => uc.projectorRoom.execute());
  };
