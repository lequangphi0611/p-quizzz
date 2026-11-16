import { networkInterfaces } from 'node:os';

/** IPv4 addresses of this machine that other devices on the LAN can reach (loopback excluded). */
export function lanIPv4(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((n): n is NonNullable<typeof n> => !!n && n.family === 'IPv4' && !n.internal)
    .map(n => n.address);
}

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
