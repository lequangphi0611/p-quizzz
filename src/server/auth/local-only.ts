import { networkInterfaces } from 'node:os';
import type { FastifyReply, FastifyRequest } from 'fastify';

export const LOCAL_ONLY_MESSAGE = 'Trang quản trị chỉ truy cập được từ máy đang chạy ứng dụng';

// Addresses of this machine's own interfaces: opening the app through its own LAN IP from the same
// machine reaches the server from that IP, not from 127.0.0.1, and must still count as "local".
function ownAddresses(): Set<string> {
  return new Set(Object.values(networkInterfaces()).flat().filter(Boolean).map(n => normalize(n!.address)));
}

// "::ffff:192.168.1.5" (IPv4 over a dual-stack socket) and "192.168.1.5" are the same peer.
const normalize = (addr: string) => addr.toLowerCase().replace(/^::ffff:/, '');

export function isLocalAddress(addr: string, own: Set<string> = ownAddresses()): boolean {
  const a = normalize(addr);
  return a === '::1' || a.startsWith('127.') || own.has(a);
}

// Blocks /api/admin/* for anything that is not the mentor's own machine, before any auth runs: a member on
// the LAN cannot even try passwords, and cannot claim the first-run password setup.
// `req.ip` is the socket peer (X-Forwarded-For is honoured only from loopback, see buildApp's trustProxy).
export function requireLocal(allowRemote: boolean) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (allowRemote || isLocalAddress(req.ip)) return;
    return reply.code(403).send({ error: LOCAL_ONLY_MESSAGE });
  };
}
