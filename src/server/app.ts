import { resolve } from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import type { Db } from './db/client.js';
import { eventsRoutes } from './routes/events.js';
import { healthRoutes } from './routes/health.js';

export interface AppOptions {
  db: Db;
  serveWeb?: boolean;
  logger?: boolean;
}

// Builds the Fastify app without listening, so tests can use app.inject().
export async function buildApp({ db, serveWeb = false, logger = false }: AppOptions) {
  const app = Fastify({ logger });
  app.decorate('db', db);

  await app.register(healthRoutes);
  await app.register(eventsRoutes);

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
