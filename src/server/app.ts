import { resolve } from 'node:path';
import Fastify, { type FastifyPluginAsync } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import type { Db } from './db/client.js';
import { compose, type Composition } from './composition.js';
import { meRoutes, participantReviewRoutes } from './interface/http/attempts-routes.js';
import { adminRoutes } from './interface/http/admin-routes.js';
import { examsRoutes } from './interface/http/exams-routes.js';
import type { JoinLimiter } from './interface/http/join-limiter.js';
import { joinRoutes, participantsAdminRoutes, publicParticipantsRoutes } from './interface/http/participants-routes.js';
import { publicSessionsRoutes, sessionsRoutes } from './interface/http/sessions-routes.js';
import { registerLeakGuard } from './leak-guard.js';
import { gradingRoutes } from './routes/grading.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { networkRoutes } from './routes/network.js';
import { screenRoutes } from './routes/screen.js';
import { eventsRoutes } from './routes/events.js';
import { healthRoutes } from './routes/health.js';

export interface AppOptions {
  db: Db;
  /** Use cases for modules already on Clean Architecture. Defaults to `compose(db)`; tests may inject fakes. */
  composition?: Composition;
  serveWeb?: boolean;
  logger?: boolean;
  /** Let machines other than the mentor's reach /api/admin/*. Off by default: members share the LAN. */
  allowRemoteAdmin?: boolean;
  /** Counts wrong room codes per address (tests inject a tighter or looser one). */
  joinLimiter?: JoinLimiter;
  /** LAN addresses reported by /api/network (tests inject fixed ones). */
  lanIps?: () => string[];
  /** Extra route plugins mounted inside the requireMentor scope of /api/admin (stories add theirs here; tests use it for probes). */
  adminRoutes?: FastifyPluginAsync[];
}

// Builds the Fastify app without listening, so tests can use app.inject().
export async function buildApp({ db, composition = compose(db), serveWeb = false, logger = false, allowRemoteAdmin = false, lanIps, joinLimiter, adminRoutes: extraAdminRoutes = [] }: AppOptions) {
  const protectedRoutes = [examsRoutes(composition.exams), sessionsRoutes(composition.sessions), participantsAdminRoutes(composition.participants), participantReviewRoutes(composition.attempts), gradingRoutes, ...extraAdminRoutes];
  // Honour X-Forwarded-For only when the direct peer is this machine (the Vite dev proxy). A LAN client
  // connecting straight to the server is not trusted, so it cannot forge its address.
  const app = Fastify({ logger, trustProxy: ['127.0.0.1', '::1'] });
  app.decorate('db', db);
  registerLeakGuard(app);

  await app.register(fastifyCookie);
  await app.register(healthRoutes);
  await app.register(adminRoutes(composition.admin), { protectedRoutes, allowRemote: allowRemoteAdmin });
  await app.register(eventsRoutes);
  await app.register(publicSessionsRoutes(composition.sessions));
  await app.register(leaderboardRoutes);
  await app.register(joinRoutes(composition.participants), { limiter: joinLimiter });
  await app.register(screenRoutes);
  await app.register(publicParticipantsRoutes(composition.participants));
  await app.register(networkRoutes, { lanIps });
  await app.register(meRoutes(composition.attempts, composition.resumeParticipant));

  if (serveWeb) {
    await app.register(fastifyStatic, { root: resolve('dist/web') });
    // SPA fallback: any non-API GET returns index.html.
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
      return reply.code(404).send({ error: 'Not found' });
    });
  }

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}
