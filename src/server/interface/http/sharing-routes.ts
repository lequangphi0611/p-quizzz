import type { FastifyPluginAsync } from 'fastify';
import { SetSharedBody } from '../../../shared/api/index.js';
import type { SetSessionShared } from '../../application/use-cases/sharing/set-session-shared.js';
import type { GetShareLink, RotateShareLink } from '../../application/use-cases/sharing/share-link.js';
import type { GetSharedSession, ListSharedSessions } from '../../application/use-cases/sharing/shared-sessions.js';
import { SessionNotFoundError } from '../../domain/session/errors.js';
import { SessionNotSharedError } from '../../domain/sharing/sharing.js';
import { sendDomainError } from './domain-errors.js';
import { parseId } from './params.js';

export interface SharingUseCases {
  setShared: SetSessionShared;
  link: GetShareLink;
  rotate: RotateShareLink;
  list: ListSharedSessions;
  get: GetSharedSession;
}

// Mentor side of the share page (PRODUCT.md §7.33). Registered inside the requireMentor scope of /api/admin.
export const sharingAdminRoutes = (uc: SharingUseCases): FastifyPluginAsync =>
  async app => {
    app.put<{ Params: { id: string } }>('/sessions/:id/share', async (req, reply) => {
      const id = parseId(req.params.id);
      if (!id) return sendDomainError(reply, new SessionNotFoundError());
      const body = SetSharedBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'Dữ liệu không hợp lệ' });
      try {
        const detail = await uc.setShared.execute(id, body.data.shared);
        return { sharedAt: detail.sharedAt ? detail.sharedAt.getTime() : null };
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    app.get('/share-link', async () => uc.link.execute());
    app.post('/share-link/rotate', async () => uc.rotate.execute());
  };

// The share page itself: anyone holding the link (PRODUCT.md §7.33). Only aggregate data; leak-guard checks the keys.
export const sharedPublicRoutes = (uc: SharingUseCases): FastifyPluginAsync =>
  async app => {
    app.get<{ Params: { token: string } }>('/api/shared/:token/sessions', async (req, reply) => {
      try {
        return await uc.list.execute(req.params.token);
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    app.get<{ Params: { token: string; id: string } }>('/api/shared/:token/sessions/:id', async (req, reply) => {
      try {
        const id = parseId(req.params.id);
        // A malformed id must not tell a wrong link apart from a right one: check the token first.
        if (!id) {
          await uc.list.execute(req.params.token);
          throw new SessionNotSharedError();
        }
        return await uc.get.execute(req.params.token, id);
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });
  };
