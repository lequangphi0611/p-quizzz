import type { FastifyPluginAsync } from 'fastify';
import { CreateTrainingBody, JoinTrainingBody, type HookConfig, type JoinTrainingResponse, type MyTraining, type TrainingDetail } from '../../../shared/api/training.js';
import { WrongRoomCodeError } from '../../domain/participant/errors.js';
import { TrainingMemberNotFoundError, TrainingNotFoundError } from '../../domain/training/errors.js';
import type { CreateTraining, EndTraining, GetTrainingDetail, ListTrainings, RemoveTrainingMember, StopTraining } from '../../application/use-cases/training/admin.js';
import type { GetHookConfig, GetMyTraining, JoinTraining, ResumeTrainingMember, WithdrawTrainingConsent } from '../../application/use-cases/training/member.js';
import { requireTrainingMember } from './auth/training-auth.js';
import { sendDomainError } from './domain-errors.js';
import { createJoinLimiter, type JoinLimiter } from './join-limiter.js';
import { parseId } from './params.js';
import { toCreatedTrainingDto, toTrainingDetailDto, toTrainingSummaryDto } from './presenters/training-presenter.js';

export interface TrainingUseCases {
  create: CreateTraining;
  list: ListTrainings;
  detail: GetTrainingDetail;
  stop: StopTraining;
  end: EndTraining;
  removeMember: RemoveTrainingMember;
  join: JoinTraining;
  resume: ResumeTrainingMember;
  me: GetMyTraining;
  hookConfig: GetHookConfig;
  withdraw: WithdrawTrainingConsent;
}

const badBody = (issue: { message: string } | undefined) => ({ error: issue?.message ?? 'Dữ liệu không hợp lệ' });

// Mentor routes (PRODUCT.md §7.34). Registered inside the requireMentor scope of /api/admin, so they only answer on the mentor's machine.
export const trainingAdminRoutes = (uc: Pick<TrainingUseCases, 'create' | 'list' | 'detail' | 'stop' | 'end' | 'removeMember'>): FastifyPluginAsync =>
  async app => {
    app.post('/trainings', async (req, reply) => {
      const body = CreateTrainingBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send(badBody(body.error.issues[0]));
      return reply.code(201).send(toCreatedTrainingDto(await uc.create.execute(body.data.name)));
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
export const trainingMemberRoutes = (uc: Pick<TrainingUseCases, 'join' | 'resume' | 'me' | 'hookConfig' | 'withdraw'>): FastifyPluginAsync<{ limiter?: JoinLimiter }> =>
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

      scope.delete('/api/training/me', async (req, reply) => {
        await uc.withdraw.execute(req.trainingMember!);
        return reply.code(204).send();
      });
    });
  };
