import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';
import { PasswordBody, type AdminStatus } from '../../../shared/api/index.js';
import { AdminAlreadySetupError, InvalidCredentialsError } from '../../domain/auth/errors.js';
import type { AuthenticateAdmin, GetAdminStatus, LoginAdmin, LogoutAdmin, SetupAdmin } from '../../application/use-cases/admin/admin-use-cases.js';
import { ADMIN_COOKIE, requireMentor } from './auth/mentor-auth.js';
import { requireLocal } from './auth/require-local.js';
import { sendDomainError } from './domain-errors.js';

export interface AdminUseCases {
  status: GetAdminStatus;
  setup: SetupAdmin;
  login: LoginAdmin;
  logout: LogoutAdmin;
  authenticate: AuthenticateAdmin;
}

export interface AdminRoutesOptions {
  protectedRoutes?: FastifyPluginAsync[];
  allowRemote?: boolean;
}

// Mentor API under /api/admin.
// Public: status, setup, login, logout. Everything registered in `protectedRoutes` sits behind requireMentor —
// later stories add their route plugins to that list (see buildApp).
export const adminRoutes = (uc: AdminUseCases) =>
  async (app: FastifyInstance, opts: AdminRoutesOptions = {}) => {
    const setCookie = (reply: FastifyReply, token: string) => reply.setCookie(ADMIN_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/' });

    await app.register(
      async admin => {
        // First hook of the whole /api/admin scope (public and protected routes alike): mentor machine only.
        admin.addHook('onRequest', requireLocal(opts.allowRemote ?? false));

        admin.get('/status', async (req): Promise<AdminStatus> => uc.status.execute(req.cookies[ADMIN_COOKIE]));

        admin.post('/setup', async (req, reply) => {
          // Already set up wins over a bad body: check first, without hashing.
          if ((await uc.status.execute(undefined)).setupDone) return sendDomainError(reply, new AdminAlreadySetupError());
          const body = PasswordBody.safeParse(req.body);
          if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
          try {
            setCookie(reply, await uc.setup.execute(body.data.password));
            return { ok: true };
          } catch (err) {
            return sendDomainError(reply, err);
          }
        });

        admin.post('/login', async (req, reply) => {
          const password = (req.body as { password?: unknown } | null)?.password;
          try {
            if (typeof password !== 'string') throw new InvalidCredentialsError();
            setCookie(reply, await uc.login.execute(password));
            return { ok: true };
          } catch (err) {
            return sendDomainError(reply, err);
          }
        });

        admin.post('/logout', async (req, reply) => {
          uc.logout.execute(req.cookies[ADMIN_COOKIE]);
          reply.clearCookie(ADMIN_COOKIE, { path: '/' });
          return { ok: true };
        });

        // Protected scope: the hook applies to every route registered inside it.
        await admin.register(async scope => {
          scope.addHook('onRequest', requireMentor(uc.authenticate));
          for (const plugin of opts.protectedRoutes ?? []) await scope.register(plugin);
        });
      },
      { prefix: '/api/admin' },
    );
  };
