import { resolve } from 'node:path';
import Fastify, { type FastifyPluginAsync } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import type { Db } from './db/client.js';
import { adminRoutes as adminRoutesPlugin } from './routes/admin.js';
import { examsRoutes } from './routes/exams.js';
import { publicSessionsRoutes, sessionsRoutes } from './routes/sessions.js';
import { eventsRoutes } from './routes/events.js';
import { healthRoutes } from './routes/health.js';

export interface AppOptions {
  db: Db;
  serveWeb?: boolean;
  logger?: boolean;
  /** Extra route plugins mounted inside the requireMentor scope of /api/admin (stories add theirs here; tests use it for probes). */
  adminRoutes?: FastifyPluginAsync[];
}

// Builds the Fastify app without listening, so tests can use app.inject().
export async function buildApp({ db, serveWeb = false, logger = false, adminRoutes: extraAdminRoutes = [] }: AppOptions) {
  const protectedRoutes = [examsRoutes, sessionsRoutes, ...extraAdminRoutes];
  const app = Fastify({ logger });
  app.decorate('db', db);

  await app.register(fastifyCookie);
  await app.register(healthRoutes);
  await app.register(adminRoutesPlugin, { protectedRoutes });
  await app.register(eventsRoutes);
  await app.register(publicSessionsRoutes);

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
