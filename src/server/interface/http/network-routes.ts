import type { FastifyPluginAsync } from 'fastify';
import type { NetworkInfo } from '../../../shared/api/index.js';

/**
 * "host:port" strings members can type, built from the LAN addresses and the port the request came in on
 * (so it is right for both `npm start` and the Vite dev server). `hostHeader` is the request's Host header.
 */
export function joinHosts(lanIps: string[], hostHeader: string | undefined, fallbackPort: number): string[] {
  let port = String(fallbackPort);
  try {
    if (hostHeader) port = new URL(`http://${hostHeader}`).port || '80';
  } catch { /* malformed Host header: keep the fallback */ }
  return lanIps.map(ip => (port === '80' ? ip : `${ip}:${port}`));
}

// GET /api/network: public. Where members can reach this server (the mentor's own browser often shows
// "localhost", which is useless to read out loud). The LAN addresses are no secret: anyone who connected knows them.
export const networkRoutes = (opts: { lanIps: () => string[]; port: number }): FastifyPluginAsync =>
  async app => {
    app.get('/api/network', async (req): Promise<NetworkInfo> => ({ joinHosts: joinHosts(opts.lanIps(), req.headers.host, opts.port) }));
  };
