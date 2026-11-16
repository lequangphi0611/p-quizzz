import { desc, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ScreenRoom } from '../../shared/api/index.js';
import { ACTIVE_STATUSES } from '../../shared/session-state.js';
import { requireLocal } from '../auth/local-only.js';
import { sessions } from '../db/schema.js';

// GET /api/screen/room — the projector shows the room code. Anyone on the LAN can read /api/sessions/latest, so the
// code is NOT there; it comes from this route, which only answers on the mentor's machine (loopback or its own
// address) and ignores --allow-remote-admin: that flag must never publish the code.
export async function screenRoutes(app: FastifyInstance) {
  app.get('/api/screen/room', { onRequest: requireLocal(false) }, async (): Promise<ScreenRoom> => {
    const row = app.db
      .select({ roomCode: sessions.roomCode })
      .from(sessions)
      .where(inArray(sessions.status, [...ACTIVE_STATUSES]))
      .orderBy(desc(sessions.id))
      .get();
    return { roomCode: row?.roomCode ?? null };
  });
}
