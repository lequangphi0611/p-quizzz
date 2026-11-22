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

// GET /api/admin/events: ONE stream with every session's change signals, for the mentor's bell and session bar.
// Browsers allow only ~6 HTTP/1.1 connections per address, so the bell cannot open one stream per open session.
// Registered inside the requireMentor scope of /api/admin. Payload is `{"sessionId":N}`: still only a signal, clients refetch.
export const adminEventsRoutes = (events: EventSubscriber): FastifyPluginAsync<{ heartbeatMs?: number }> =>
  async (app, opts) => {
    const heartbeatMs = opts.heartbeatMs ?? HEARTBEAT_MS;
    const open = new Set<ServerResponse>();
    app.addHook('onClose', async () => { for (const res of open) res.end(); });

    app.get('/events', (req, reply) => {
      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(': connected\n\n');
      open.add(res);

      const offSessions = events.subscribeAll((sessionId, type) => res.write(`event: ${type}\ndata: ${JSON.stringify({ sessionId })}\n\n`));
      // AI training (PRODUCT.md §7.34): same stream, its own event name and id key. Clients that do not know it ignore it.
      const offTraining = events.subscribeTraining(trainingId => res.write(`event: training\ndata: ${JSON.stringify({ trainingId })}\n\n`));
      const unsubscribe = () => { offSessions(); offTraining(); };
      const ping = setInterval(() => res.write(': ping\n\n'), heartbeatMs);
      req.raw.on('close', () => {
        clearInterval(ping);
        unsubscribe();
        open.delete(res);
      });
    });
  };
