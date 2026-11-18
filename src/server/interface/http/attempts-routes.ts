import type { FastifyPluginAsync } from 'fastify';
import { EditRequestBody, ReadyBody, SaveAnswerBody, type AttemptView, type MeResponse, type ReviewView, type SubmitResponse } from '../../../shared/api/index.js';
import type { GetAttemptReview, GetAttemptView, GetMemberState, GetParticipantReview } from '../../application/use-cases/attempts/queries.js';
import type { FinishEdit, RequestEdit, ResolveEditRequest } from '../../application/use-cases/attempts/edit-request.js';
import type { SaveAnswer } from '../../application/use-cases/attempts/save-answer.js';
import type { StartAttempt } from '../../application/use-cases/attempts/start-attempt.js';
import type { SubmitAttempt } from '../../application/use-cases/attempts/submit-attempt.js';
import { AttemptNotFoundError } from '../../domain/attempt/errors.js';
import { ParticipantNotFoundError } from '../../domain/participant/errors.js';
import type { ResumeParticipant } from '../../application/use-cases/participants/resume-participant.js';
import type { SetReady } from '../../application/use-cases/participants/set-ready.js';
import { requireParticipant } from './auth/participant-auth.js';
import { sendDomainError } from './domain-errors.js';
import { parseId } from './params.js';
import { toAttemptViewDto, toMeResponseDto, toParticipantReviewDto, toReviewViewDto, toSubmitResponseDto } from './presenters/attempt-presenter.js';

export interface AttemptUseCases {
  start: StartAttempt;
  view: GetAttemptView;
  review: GetAttemptReview;
  saveAnswer: SaveAnswer;
  submit: SubmitAttempt;
  memberState: GetMemberState;
  participantReview: GetParticipantReview;
  requestEdit: RequestEdit;
  finishEdit: FinishEdit;
  resolveEdit: ResolveEditRequest;
  /** "Sẵn sàng" in the lobby (PRODUCT.md §7.31d). */
  setReady: SetReady;
}

// Member routes under /api/me, behind requireParticipant (so `req.participant` is set).
// Every response is a member DTO: see shared/api/attempts.ts for the no-answer-key rule.
export const meRoutes = (uc: AttemptUseCases, resume: ResumeParticipant): FastifyPluginAsync =>
  async function meRoutes(app) {
    app.decorateRequest('participant', null);
    await app.register(
      async me => {
        me.addHook('onRequest', requireParticipant(resume));
        me.get('/', async (req, reply): Promise<MeResponse | undefined> => {
          try {
            return toMeResponseDto(await uc.memberState.execute(req.participant!));
          } catch (err) {
            return sendDomainError(reply, err);
          }
        });

        me.put('/ready', async (req, reply) => {
          const body = ReadyBody.safeParse(req.body);
          if (!body.success) return reply.code(400).send({ error: 'Dữ liệu không hợp lệ' });
          try {
            await uc.setReady.execute(req.participant!.id, body.data.ready);
            return { ok: true };
          } catch (err) {
            return sendDomainError(reply, err);
          }
        });

        me.post('/attempts', async (req, reply): Promise<AttemptView | undefined> => {
          try {
            return reply.code(201).send(toAttemptViewDto(await uc.start.execute(req.participant!.id)));
          } catch (err) {
            return sendDomainError(reply, err);
          }
        });

        me.get<{ Params: { id: string } }>('/attempts/:id', async (req, reply): Promise<AttemptView | undefined> => {
          try {
            const id = parseId(req.params.id);
            if (!id) throw new AttemptNotFoundError();
            return toAttemptViewDto(await uc.view.execute(req.participant!, id));
          } catch (err) {
            return sendDomainError(reply, err);
          }
        });

        // After the session closes: the member's own attempt with the answer key. 403 before that.
        me.get<{ Params: { id: string } }>('/attempts/:id/review', async (req, reply): Promise<ReviewView | undefined> => {
          try {
            const id = parseId(req.params.id);
            if (!id) throw new AttemptNotFoundError();
            return toReviewViewDto(await uc.review.execute(req.participant!, id));
          } catch (err) {
            return sendDomainError(reply, err);
          }
        });

        me.put<{ Params: { id: string; questionId: string } }>('/attempts/:id/answers/:questionId', async (req, reply) => {
          const id = parseId(req.params.id);
          const questionId = parseId(req.params.questionId);
          if (!id || !questionId) return sendDomainError(reply, new AttemptNotFoundError());
          const body = SaveAnswerBody.safeParse(req.body);
          if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
          try {
            await uc.saveAnswer.execute({ participantId: req.participant!.id, attemptId: id, questionId, answer: body.data });
            return { ok: true };
          } catch (err) {
            return sendDomainError(reply, err);
          }
        });

        // Ask the mentor to reopen the essays of a submitted attempt (PRODUCT.md §7.21).
        me.post<{ Params: { id: string } }>('/attempts/:id/edit-request', async (req, reply) => {
          const id = parseId(req.params.id);
          if (!id) return sendDomainError(reply, new AttemptNotFoundError());
          const body = EditRequestBody.safeParse(req.body);
          if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
          try {
            await uc.requestEdit.execute({ participantId: req.participant!.id, attemptId: id, reason: body.data.reason });
            return reply.code(201).send({ ok: true });
          } catch (err) {
            return sendDomainError(reply, err);
          }
        });

        me.post<{ Params: { id: string } }>('/attempts/:id/edit-request/finish', async (req, reply) => {
          const id = parseId(req.params.id);
          if (!id) return sendDomainError(reply, new AttemptNotFoundError());
          try {
            await uc.finishEdit.execute({ participantId: req.participant!.id, attemptId: id });
            return { ok: true };
          } catch (err) {
            return sendDomainError(reply, err);
          }
        });

        me.post<{ Params: { id: string } }>('/attempts/:id/submit', async (req, reply): Promise<SubmitResponse | undefined> => {
          try {
            const id = parseId(req.params.id);
            if (!id) throw new AttemptNotFoundError();
            return toSubmitResponseDto(await uc.submit.execute({ participantId: req.participant!.id, attemptId: id }));
          } catch (err) {
            return sendDomainError(reply, err);
          }
        });
      },
      { prefix: '/api/me' },
    );
  };

// Mentor route, registered inside the requireMentor scope of /api/admin: who took part and how they answered
// (the "view the session again" screen). Any session status.
export const participantReviewRoutes = (uc: Pick<AttemptUseCases, 'participantReview' | 'resolveEdit'>): FastifyPluginAsync =>
  async app => {
    app.get<{ Params: { id: string } }>('/participants/:id/review', async (req, reply) => {
      try {
        const id = parseId(req.params.id);
        if (!id) throw new ParticipantNotFoundError();
        return toParticipantReviewDto(await uc.participantReview.execute(id));
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    // Mentor settles a member's request to edit their essays (PRODUCT.md §7.21).
    for (const decision of ['approve', 'reject'] as const) {
      app.post<{ Params: { id: string } }>(`/participants/:id/edit-request/${decision}`, async (req, reply) => {
        try {
          const id = parseId(req.params.id);
          if (!id) throw new ParticipantNotFoundError();
          await uc.resolveEdit.execute({ participantId: id, decision });
          return { ok: true };
        } catch (err) {
          return sendDomainError(reply, err);
        }
      });
    }
  };
