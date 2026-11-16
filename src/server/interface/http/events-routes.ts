import type { ServerResponse } from 'node:http';
import type { FastifyPluginAsync } from 'fastify';
import type { EventSubscriber } from '../../application/ports/event-subscriber.js';

export const HEARTBEAT_MS = 20_000;

// GET /api/sessions/:id/events — Server-Sent Events. Public; carries no data, only change signals.
export const eventsRoutes = (events: EventSubscriber): FastifyPluginAsync<{ heartbeatMs?: number }> =>
  async (app, opts) => {
    const heartbeatMs = opts.heartbeatMs ?? HEARTBEAT_MS;
    const open = new Set<ServerResponse>();

    // Without this, app.close() would wait forever on hijacked streams.
    app.addHook('onClose', async () => { for (const res of open) res.end(); });

    app.get<{ Params: { id: string } }>('/api/sessions/:id/events', (req, reply) => {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId) || sessionId <= 0) return reply.code(404).send({ error: 'Không tìm thấy phiên' });

      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // ask reverse proxies not to buffer
      });
      res.write(': connected\n\n'); // flush headers right away
      open.add(res);

      const unsubscribe = events.subscribe(sessionId, type => res.write(`event: ${type}\ndata: {}\n\n`));
      const ping = setInterval(() => res.write(': ping\n\n'), heartbeatMs);

      req.raw.on('close', () => {
        clearInterval(ping);
        unsubscribe();
        open.delete(res);
      });
    });
  };
