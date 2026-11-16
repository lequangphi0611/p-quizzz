import type { FastifyPluginAsync } from 'fastify';
import { GroupBody, PreviewEmailsBody, type EmailListPreview, type GroupDetail, type GroupSummary } from '../../../shared/api/index.js';
import { parseEmailList } from '../../../shared/email-list.js';
import { GroupNotFoundError } from '../../domain/group/errors.js';
import type { GroupDetailView, GroupSummaryView } from '../../application/ports/group-repository.js';
import type { CreateGroup, DeleteGroup, GetGroup, ListGroups, UpdateGroup } from '../../application/use-cases/groups/groups.js';
import { sendDomainError } from './domain-errors.js';
import { parseId } from './params.js';

export interface GroupUseCases {
  list: ListGroups;
  get: GetGroup;
  create: CreateGroup;
  update: UpdateGroup;
  remove: DeleteGroup;
}

const toSummary = (g: GroupSummaryView): GroupSummary => ({
  id: g.id, name: g.name, emailCount: g.emailCount, createdAt: g.createdAt.getTime(), updatedAt: g.updatedAt.getTime(), lastUsedAt: g.lastUsedAt ? g.lastUsedAt.getTime() : null,
});
const toDetail = (g: GroupDetailView): GroupDetail => ({ ...toSummary(g), emails: g.emails });
const badBody = (issue: { message: string } | undefined) => ({ error: issue?.message ?? 'Dữ liệu không hợp lệ' });

// Mentor routes (inside the requireMentor scope of /api/admin). Emails are mentor-only data (PRODUCT.md §7.24).
export const groupsRoutes = (uc: GroupUseCases): FastifyPluginAsync =>
  async app => {
    // Parse pasted text without saving: the live preview (valid / merged duplicates / bad lines).
    app.post('/groups/preview', { bodyLimit: 512 * 1024 }, async (req, reply): Promise<EmailListPreview | undefined> => {
      const body = PreviewEmailsBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send(badBody(body.error.issues[0]));
      return parseEmailList(body.data.text, body.data.defaultDomain);
    });

    app.get('/groups', async (): Promise<GroupSummary[]> => (await uc.list.execute()).map(toSummary));

    app.post('/groups', { bodyLimit: 512 * 1024 }, async (req, reply) => {
      const body = GroupBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send(badBody(body.error.issues[0]));
      try {
        return reply.code(201).send(toDetail(await uc.create.execute(body.data)));
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    app.get<{ Params: { id: string } }>('/groups/:id', async (req, reply) => {
      try {
        const id = parseId(req.params.id);
        if (!id) throw new GroupNotFoundError();
        return toDetail(await uc.get.execute(id));
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    app.put<{ Params: { id: string } }>('/groups/:id', { bodyLimit: 512 * 1024 }, async (req, reply) => {
      const id = parseId(req.params.id);
      if (!id) return reply.code(404).send({ error: new GroupNotFoundError().message });
      const body = GroupBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send(badBody(body.error.issues[0]));
      try {
        return toDetail(await uc.update.execute(id, body.data));
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });

    app.delete<{ Params: { id: string } }>('/groups/:id', async (req, reply) => {
      try {
        const id = parseId(req.params.id);
        if (!id) throw new GroupNotFoundError();
        await uc.remove.execute(id);
        return reply.code(204).send();
      } catch (err) {
        return sendDomainError(reply, err);
      }
    });
  };
