import type { FastifyInstance } from 'fastify';
import type { NetworkInfo } from '../../shared/api/index.js';
import { config } from '../config.js';
import { joinHosts, lanIPv4 } from '../network.js';

// GET /api/network — public. Where members can reach this server (the mentor's own browser often shows
// "localhost", which is useless to read out loud). The LAN addresses are no secret: anyone who connected knows them.
export async function networkRoutes(app: FastifyInstance, opts: { lanIps?: () => string[] } = {}) {
  const lanIps = opts.lanIps ?? lanIPv4;
  app.get('/api/network', async (req): Promise<NetworkInfo> => ({ joinHosts: joinHosts(lanIps(), req.headers.host, config.port) }));
}
