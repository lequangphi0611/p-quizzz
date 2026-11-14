import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';
import { PasswordBody, type AdminStatus } from '../../shared/api/index.js';
import { ADMIN_COOKIE, createMentorAuth, requireMentor } from '../auth/mentor.js';

// Mentor API under /api/admin.
// Public: status, setup, login, logout. Everything registered in `protectedRoutes` sits behind requireMentor —
// later stories add their route plugins to that list (see buildApp).
export async function adminRoutes(app: FastifyInstance, opts: { protectedRoutes?: FastifyPluginAsync[] } = {}) {
  const auth = createMentorAuth(app.db);

  const setCookie = (reply: FastifyReply) =>
    reply.setCookie(ADMIN_COOKIE, auth.issueToken(), { httpOnly: true, sameSite: 'lax', path: '/' });

  await app.register(
    async admin => {
      admin.get('/status', async (req): Promise<AdminStatus> => ({
        setupDone: auth.isSetup(),
        loggedIn: auth.hasToken(req.cookies[ADMIN_COOKIE]),
      }));

      admin.post('/setup', async (req, reply) => {
        if (auth.isSetup()) return reply.code(409).send({ error: 'Đã thiết lập mật khẩu rồi' });
        const body = PasswordBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
        await auth.setPassword(body.data.password);
        setCookie(reply);
        return { ok: true };
      });

      admin.post('/login', async (req, reply) => {
        const password = (req.body as { password?: unknown } | null)?.password;
        // Same generic message whether the password is wrong, missing or not set up yet.
        if (typeof password !== 'string' || !(await auth.checkPassword(password))) {
          return reply.code(401).send({ error: 'Sai mật khẩu' });
        }
        setCookie(reply);
        return { ok: true };
      });

      admin.post('/logout', async (req, reply) => {
        auth.revoke(req.cookies[ADMIN_COOKIE]);
        reply.clearCookie(ADMIN_COOKIE, { path: '/' });
        return { ok: true };
      });

      // Protected scope: the hook applies to every route registered inside it.
      await admin.register(async scope => {
        scope.addHook('onRequest', requireMentor(auth));
        for (const plugin of opts.protectedRoutes ?? []) await scope.register(plugin);
      });
    },
    { prefix: '/api/admin' },
  );
}
