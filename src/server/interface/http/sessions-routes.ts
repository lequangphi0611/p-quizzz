import type { FastifyPluginAsync } from 'fastify';
import { AddRosterBody, CreateSessionBody, SaveGroupBody, ScoreVisibilityBody } from '../../../shared/api/index.js';
import { SESSION_ACTIONS, type SessionAction } from '../../../shared/session-state.js';
import { SessionNotFoundError } from '../../domain/session/errors.js';
import type { CreateSession } from '../../application/use-cases/sessions/create-session.js';
import type { FinalizeSession } from '../../application/use-cases/sessions/finalize-session.js';
import type { CloseSession } from '../../application/use-cases/sessions/close-session.js';
import type { OpenSession } from '../../application/use-cases/sessions/open-session.js';
import type { StartSession } from '../../application/use-cases/sessions/start-session.js';
import type { PresenceTracker } from '../../application/ports/presence-tracker.js';
import type { AddRosterEmails, SaveSessionGroup } from '../../application/use-cases/sessions/roster.js';
import type { ReleaseScores, SetScoreVisibility } from '../../application/use-cases/sessions/score-visibility.js';
import type { GetPublicSession, GetSessionDetail, ListSessions } from '../../application/use-cases/sessions/queries.js';
import { sendDomainError } from './domain-errors.js';
import { parseId } from './params.js';
import { toActiveSessionDto, toSessionDetailDto, toSessionSummaryDto } from './presenters/session-presenter.js';

export interface SessionUseCases {
  /** Who is still connected, for the mentor's detail view. */
  presence: PresenceTracker;
  create: CreateSession;
  list: ListSessions;
  get: GetSessionDetail;
  open: OpenSession;
  start: StartSession;
  close: CloseSession;
  finalize: FinalizeSession;
  publicSession: GetPublicSession;
  addRoster: AddRosterEmails;
  saveGroup: SaveSessionGroup;
  setScoreVisibility: SetScoreVisibility;
  releaseScores: ReleaseScores;
}

// Mentor session routes. Registered inside the requireMentor scope of /api/admin (see buildApp).
export const sessionsRoutes = (uc: SessionUseCases): FastifyPluginAsync =>
  async app => {
    const lifecycle: Record<SessionAction, { execute(id: number): Promise<Parameters<typeof toSessionDetailDto>[0]> }> = {
      open: uc.open,
      start: uc.start,
      close: uc.close,
      finalize: uc.finalize,
    };

    app.post('/sessions', async (req, reply) => {
      const body = CreateSessionBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
      try {
        return reply.code(201).send(toSessionDetailDto(await uc.create.execute(body.data), uc.presence));
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    // ?active=true: only sessions in lobby/running, lowest slot first (the overview, the bell, the session bar).
    app.get<{ Querystring: { active?: string } }>('/sessions', async req => (await uc.list.execute(req.query.active === 'true')).map(toSessionSummaryDto));

    app.get<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
      try {
        const id = parseId(req.params.id);
        if (!id) throw new SessionNotFoundError();
        return toSessionDetailDto(await uc.get.execute(id), uc.presence);
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    // Mentor lets more emails into this session's list (an exception); the saved group it came from is untouched.
    app.post<{ Params: { id: string } }>('/sessions/:id/roster', async (req, reply) => {
      const id = parseId(req.params.id);
      if (!id) return reply.code(404).send({ error: new SessionNotFoundError().message });
      const body = AddRosterBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
      try {
        return toSessionDetailDto(await uc.addRoster.execute(id, body.data.emails), uc.presence);
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    // Saves the typed list of this session as a group for later sessions.
    app.post<{ Params: { id: string } }>('/sessions/:id/save-group', async (req, reply) => {
      const id = parseId(req.params.id);
      if (!id) return reply.code(404).send({ error: new SessionNotFoundError().message });
      const body = SaveGroupBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
      try {
        const g = await uc.saveGroup.execute(id, body.data.name);
        return reply.code(201).send({ id: g.id, name: g.name, emailCount: g.emailCount });
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    // Show scores on submit, or hold them until the mentor publishes (PRODUCT.md §7.25). Only while nobody has submitted.
    app.put<{ Params: { id: string } }>('/sessions/:id/score-visibility', async (req, reply) => {
      const id = parseId(req.params.id);
      if (!id) return reply.code(404).send({ error: new SessionNotFoundError().message });
      const body = ScoreVisibilityBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'Cách hiện điểm không hợp lệ' });
      try {
        return toSessionDetailDto(await uc.setScoreVisibility.execute(id, body.data.scoreVisibility), uc.presence);
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    // "Công bố điểm": held-back scores and ranks appear for members and the projector. Static path wins over /:action.
    app.post<{ Params: { id: string } }>('/sessions/:id/release-scores', async (req, reply) => {
      const id = parseId(req.params.id);
      if (!id) return reply.code(404).send({ error: new SessionNotFoundError().message });
      try {
        return toSessionDetailDto(await uc.releaseScores.execute(id), uc.presence);
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    app.post<{ Params: { id: string; action: string } }>('/sessions/:id/:action', async (req, reply) => {
      const id = parseId(req.params.id);
      const action = req.params.action as SessionAction;
      if (!id || !SESSION_ACTIONS.includes(action)) return reply.code(404).send({ error: 'Không tìm thấy' });
      try {
        return toSessionDetailDto(await lifecycle[action].execute(id), uc.presence);
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });
  };

// Public: the exam title and status of one session (the projector page follows it). Never the mentor's session name.
export const publicSessionsRoutes = (uc: Pick<SessionUseCases, 'publicSession'>): FastifyPluginAsync =>
  async app => {
    app.get<{ Params: { id: string } }>('/api/sessions/:id/public', async (req, reply) => {
      try {
        const id = parseId(req.params.id);
        if (!id) throw new SessionNotFoundError();
        return toActiveSessionDto(await uc.publicSession.execute(id));
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });
  };
