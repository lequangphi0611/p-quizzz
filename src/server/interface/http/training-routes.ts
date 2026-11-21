import type { FastifyPluginAsync } from 'fastify';
import { CreateTrainingBody, JoinTrainingBody, type HookConfig, type JoinTrainingResponse, type MyTraining, type TrainingDetail, type TrainingEventDetail, type TrainingEventsPage, type UninstallCheckResult } from '../../../shared/api/training.js';
import { WrongRoomCodeError } from '../../domain/participant/errors.js';
import { TrainingEventNotFoundError, TrainingMemberNotFoundError, TrainingNotFoundError } from '../../domain/training/errors.js';
import type { CreateTraining, EndTraining, GetTrainingDetail, ListTrainings, PurgeTrainingMember, RemoveTrainingMember, StopTraining } from '../../application/use-cases/training/admin.js';
import type { GetTrainingEventDetail, ListMemberEvents } from '../../application/use-cases/training/view.js';
import type { IngestHookEvent } from '../../application/use-cases/training/ingest.js';
import type { FinishUninstallCheck, GetHookConfig, GetMyTraining, JoinTraining, ResumeTrainingMember, StartUninstallCheck, WithdrawTrainingConsent } from '../../application/use-cases/training/member.js';
import { isPermissionRequest } from '../../domain/training/filter-hook-event.js';
import { INGEST_HEADER, INGEST_PATH } from '../../domain/training/hook-settings.js';
import { requireTrainingMember } from './auth/training-auth.js';
import { sendDomainError } from './domain-errors.js';
import { createJoinLimiter, type JoinLimiter } from './join-limiter.js';
import { parseId } from './params.js';
import { toCreatedTrainingDto, toEventsPageDto, toTrainingDetailDto, toTrainingSummaryDto } from './presenters/training-presenter.js';

export interface TrainingUseCases {
  create: CreateTraining;
  list: ListTrainings;
  detail: GetTrainingDetail;
  stop: StopTraining;
  end: EndTraining;
  removeMember: RemoveTrainingMember;
  purgeMember: PurgeTrainingMember;
  memberEvents: ListMemberEvents;
  eventDetail: GetTrainingEventDetail;
  join: JoinTraining;
  resume: ResumeTrainingMember;
  me: GetMyTraining;
  hookConfig: GetHookConfig;
  withdraw: WithdrawTrainingConsent;
  startUninstallCheck: StartUninstallCheck;
  finishUninstallCheck: FinishUninstallCheck;
  ingest: IngestHookEvent;
}

const badBody = (issue: { message: string } | undefined) => ({ error: issue?.message ?? 'Dữ liệu không hợp lệ' });

// Mentor routes (PRODUCT.md §7.34). Registered inside the requireMentor scope of /api/admin, so they only answer on the mentor's machine.
export const trainingAdminRoutes = (uc: Pick<TrainingUseCases, 'create' | 'list' | 'detail' | 'stop' | 'end' | 'removeMember' | 'purgeMember' | 'memberEvents' | 'eventDetail'>): FastifyPluginAsync =>
  async app => {
    app.post('/trainings', async (req, reply) => {
      const body = CreateTrainingBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send(badBody(body.error.issues[0]));
      return reply.code(201).send(toCreatedTrainingDto(await uc.create.execute(body.data.name, { allowAutoAccept: body.data.allowAutoAccept })));
    });

    app.get('/trainings', async () => (await uc.list.execute()).map(toTrainingSummaryDto));

    app.get<{ Params: { id: string } }>('/trainings/:id', async (req, reply): Promise<TrainingDetail | undefined> => {
      try {
        const id = parseId(req.params.id);
        if (!id) throw new TrainingNotFoundError();
        return toTrainingDetailDto(await uc.detail.execute(id));
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    // A member's timeline (light rows) and, separately, the output / change of one event: the list never carries those.
    app.get<{ Params: { id: string; memberId: string }; Querystring: { after?: string } }>(
      '/trainings/:id/members/:memberId/events',
      async (req, reply): Promise<TrainingEventsPage | undefined> => {
        try {
          const id = parseId(req.params.id);
          const memberId = parseId(req.params.memberId);
          if (!id) throw new TrainingNotFoundError();
          if (!memberId) throw new TrainingMemberNotFoundError();
          const after = req.query.after === undefined ? 0 : Number(req.query.after);
          if (!Number.isInteger(after) || after < 0) return reply.code(400).send({ error: 'after phải là số nguyên không âm' });
          return toEventsPageDto(await uc.memberEvents.execute(id, memberId, after));
        } catch (err) {
          return sendDomainError(reply, err);
        }
      },
    );

    app.get<{ Params: { id: string; eventId: string } }>('/trainings/:id/events/:eventId/detail', async (req, reply): Promise<TrainingEventDetail | undefined> => {
      try {
        const id = parseId(req.params.id);
        const eventId = parseId(req.params.eventId);
        if (!id) throw new TrainingNotFoundError();
        if (!eventId) throw new TrainingEventNotFoundError();
        return await uc.eventDetail.execute(id, eventId);
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    // Both answer with the training as the page now shows it, so the screen needs no second request.
    for (const [action, useCase] of [['stop', uc.stop], ['end', uc.end]] as const) {
      app.post<{ Params: { id: string } }>(`/trainings/:id/${action}`, async (req, reply): Promise<TrainingDetail | undefined> => {
        try {
          const id = parseId(req.params.id);
          if (!id) throw new TrainingNotFoundError();
          await useCase.execute(id);
          return toTrainingDetailDto(await uc.detail.execute(id));
        } catch (err) {
          return sendDomainError(reply, err);
        }
      });
    }

    // "Duyệt xoá": only for a member who pressed "Dừng gửi" (409 for anyone else).
    app.post<{ Params: { id: string; memberId: string } }>('/trainings/:id/members/:memberId/purge', async (req, reply) => {
      try {
        const id = parseId(req.params.id);
        const memberId = parseId(req.params.memberId);
        if (!id) throw new TrainingNotFoundError();
        if (!memberId) throw new TrainingMemberNotFoundError();
        await uc.purgeMember.execute(id, memberId);
        return reply.code(204).send();
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    app.delete<{ Params: { id: string; memberId: string } }>('/trainings/:id/members/:memberId', async (req, reply) => {
      try {
        const id = parseId(req.params.id);
        const memberId = parseId(req.params.memberId);
        if (!id) throw new TrainingNotFoundError();
        if (!memberId) throw new TrainingMemberNotFoundError();
        await uc.removeMember.execute(id, memberId);
        return reply.code(204).send();
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });
  };

// Member routes: public inside the LAN. Joining needs the room code (shared wrong-code limiter with sessions);
// everything under /api/training/me needs the member token. Nothing here ever carries what was collected.
export const trainingMemberRoutes = (uc: Pick<TrainingUseCases, 'join' | 'resume' | 'me' | 'hookConfig' | 'withdraw' | 'startUninstallCheck' | 'finishUninstallCheck'>): FastifyPluginAsync<{ limiter?: JoinLimiter }> =>
  async (app, opts) => {
    const limiter = opts.limiter ?? createJoinLimiter();

    app.post<{ Params: { id: string } }>('/api/trainings/:id/join', async (req, reply) => {
      const wait = limiter.retryAfter(req.ip);
      if (wait > 0) return reply.code(429).header('Retry-After', String(wait)).send({ error: `Nhập sai mã phòng quá nhiều lần. Thử lại sau ${wait} giây` });

      const trainingId = parseId(req.params.id);
      if (!trainingId) return reply.code(404).send({ error: new TrainingNotFoundError().message });
      const body = JoinTrainingBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send(badBody(body.error.issues[0]));
      try {
        const { token, member } = await uc.join.execute({ trainingId, displayName: body.data.displayName, roomCode: body.data.roomCode });
        const res: JoinTrainingResponse = { token, member: { displayName: member.displayName } };
        return reply.code(201).send(res);
      } catch (err) {
        if (err instanceof WrongRoomCodeError) limiter.fail(req.ip);
        return sendDomainError(reply, err);
      }
    });

    await app.register(async scope => {
      scope.decorateRequest('trainingMember', null);
      scope.addHook('onRequest', requireTrainingMember(uc.resume));

      scope.get('/api/training/me', async (req): Promise<MyTraining> => uc.me.execute(req.trainingMember!));

      // The URL comes from the Host the member used to reach this server: that address is known to work from their machine.
      scope.get('/api/training/me/hook-config', async (req, reply): Promise<HookConfig | undefined> => {
        const host = req.headers.host;
        if (!host) return reply.code(400).send({ error: 'Thiếu địa chỉ máy chủ' });
        try {
          return uc.hookConfig.execute(req.trainingMember!, `http://${host}`);
        } catch (err) {
          return sendDomainError(reply, err);
        }
      });

      scope.post('/api/training/me/uninstall-check', async (req, reply) => {
        try {
          await uc.startUninstallCheck.execute(req.trainingMember!);
          return reply.code(204).send();
        } catch (err) {
          return sendDomainError(reply, err);
        }
      });

      scope.post('/api/training/me/uninstall-check/finish', async (req, reply): Promise<UninstallCheckResult | undefined> => {
        try {
          return await uc.finishUninstallCheck.execute(req.trainingMember!);
        } catch (err) {
          return sendDomainError(reply, err);
        }
      });

      // "Dừng gửi": stops intake now; the data stays until the mentor approves deleting it (409 once the training is stopped).
      scope.delete('/api/training/me', async (req, reply) => {
        try {
          await uc.withdraw.execute(req.trainingMember!);
          return reply.code(204).send();
        } catch (err) {
          return sendDomainError(reply, err);
        }
      });
    });
  };

/** What a machine that still sends after "Dừng thu" is told (Claude Code may show it). Plain text: nothing collected is in it. */
export const STOPPED_REMINDER =
  'Buổi training AI đã dừng thu. Hãy xoá phần cấu hình hook mà buổi training thêm vào file .claude/settings.local.json của thư mục bài tập, để Claude Code không gửi gì nữa.';

/** What a machine that still sends after the member's own "Dừng gửi" is told. */
export const STOPPED_SENDING_REMINDER =
  'Bạn đã dừng gửi dữ liệu cho buổi training AI. Hãy xoá phần cấu hình hook mà buổi training thêm vào file .claude/settings.local.json của thư mục bài tập, để Claude Code không gửi gì nữa.';

/** The hooks' bodies can be large (tool output): a bigger limit than the rest of the API, and never above this. */
export const INGEST_BODY_LIMIT = 2 * 1024 * 1024;

/**
 * Where Claude Code's hooks land (`POST /api/training/ingest`, token in `X-Training-Token`). Answers fast and says as little as
 * possible: it must never slow the member's Claude Code down or teach a stranger anything.
 *  - unknown token → 404, empty body; our hooks or not, a good token → 204; a stopped training → 200 with a reminder;
 *  - a body that is not valid JSON is not an error (204): a hook failing makes noise on the member's screen.
 *  - body over 2 MB → 413 (Fastify).
 *  - SAFETY: ingest never answers with `hookSpecificOutput` or `decision`. A `PermissionRequest` gets an empty 204 in every
 *    state (open, stopped, unknown token): that hook is the one whose answer can approve a command on the member's machine
 *    (spike §6.2, architecture.md §11.9).
 * Own plugin scope so the lenient body parsing applies here only.
 */
export const trainingIngestRoute = (uc: Pick<TrainingUseCases, 'ingest'>): FastifyPluginAsync =>
  async app => {
    app.removeAllContentTypeParsers();
    app.addContentTypeParser('application/json', { parseAs: 'string', bodyLimit: INGEST_BODY_LIMIT }, (_req, body, done) => {
      try {
        done(null, JSON.parse(body as string));
      } catch {
        done(null, undefined);
      }
    });
    app.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: INGEST_BODY_LIMIT }, (_req, _body, done) => done(null, undefined));

    app.post(INGEST_PATH, { bodyLimit: INGEST_BODY_LIMIT }, async (req, reply) => {
      const header = req.headers[INGEST_HEADER.toLowerCase()];
      const result = await uc.ingest.execute(typeof header === 'string' ? header : undefined, req.body);
      if (isPermissionRequest(req.body)) return reply.code(204).send();
      if (result === 'unknown') return reply.code(404).send();
      if (result === 'stopped') return reply.code(200).send({ systemMessage: STOPPED_REMINDER });
      if (result === 'stopped_sending') return reply.code(200).send({ systemMessage: STOPPED_SENDING_REMINDER });
      return reply.code(204).send();
    });
  };
