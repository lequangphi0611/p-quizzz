import { useEffect, useState } from 'react';

export const isLocalHostname = (hostname: string): boolean => /^(localhost|127(\.\d{1,3}){3}|\[?::1\]?)$/.test(hostname);

export interface JoinHost {
  host: string;
  /** True when the best we can show is a local address that other devices cannot use. */
  unreachable: boolean;
}

/**
 * What to tell members to type. If this page was opened by a real address, that address works for them too.
 * If it was opened as "localhost" (typical on the mentor's/projector machine) use a LAN address from the server.
 */
export function pickJoinHost(loc: { host: string; hostname: string }, joinHosts: readonly string[]): JoinHost {
  if (!isLocalHostname(loc.hostname)) return { host: loc.host, unreachable: false };
  if (joinHosts.length > 0) return { host: joinHosts[0]!, unreachable: false };
  return { host: loc.host, unreachable: true };
}

/**
 * The address to show members, resolved once from the server's LAN addresses (`fetchHosts`, e.g. `/api/network`).
 * Shows the browser's own host until it answers.
 */
export function useJoinHost(fetchHosts: () => Promise<string[]>): JoinHost {
  const [hosts, setHosts] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    fetchHosts().then(h => { if (live) setHosts(h); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return pickJoinHost(window.location, hosts);
}
