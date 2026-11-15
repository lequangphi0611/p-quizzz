import { resolve } from 'node:path';
import Fastify, { type FastifyPluginAsync } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import type { Db } from './db/client.js';
import { adminRoutes as adminRoutesPlugin } from './routes/admin.js';
import { examsRoutes } from './routes/exams.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { networkRoutes } from './routes/network.js';
import { joinRoutes, meRoutes, participantsRoutes, publicParticipantsRoutes } from './routes/participants.js';
import { publicSessionsRoutes, sessionsRoutes } from './routes/sessions.js';
import { eventsRoutes } from './routes/events.js';
import { healthRoutes } from './routes/health.js';

export interface AppOptions {
  db: Db;
  serveWeb?: boolean;
  logger?: boolean;
  /** Let machines other than the mentor's reach /api/admin/*. Off by default: members share the LAN. */
  allowRemoteAdmin?: boolean;
  /** LAN addresses reported by /api/network (tests inject fixed ones). */
  lanIps?: () => string[];
  /** Extra route plugins mounted inside the requireMentor scope of /api/admin (stories add theirs here; tests use it for probes). */
  adminRoutes?: FastifyPluginAsync[];
}

// Builds the Fastify app without listening, so tests can use app.inject().
export async function buildApp({ db, serveWeb = false, logger = false, allowRemoteAdmin = false, lanIps, adminRoutes: extraAdminRoutes = [] }: AppOptions) {
  const protectedRoutes = [examsRoutes, sessionsRoutes, participantsRoutes, ...extraAdminRoutes];
  // Honour X-Forwarded-For only when the direct peer is this machine (the Vite dev proxy). A LAN client
  // connecting straight to the server is not trusted, so it cannot forge its address.
  const app = Fastify({ logger, trustProxy: ['127.0.0.1', '::1'] });
  app.decorate('db', db);

  await app.register(fastifyCookie);
  await app.register(healthRoutes);
  await app.register(adminRoutesPlugin, { protectedRoutes, allowRemote: allowRemoteAdmin });
  await app.register(eventsRoutes);
  await app.register(publicSessionsRoutes);
  await app.register(leaderboardRoutes);
  await app.register(joinRoutes);
  await app.register(publicParticipantsRoutes);
  await app.register(networkRoutes, { lanIps });
  await app.register(meRoutes);

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
