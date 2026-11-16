import { networkInterfaces } from 'node:os';

/** IPv4 addresses of this machine that other devices on the LAN can reach (loopback excluded). */
export function lanIPv4(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((n): n is NonNullable<typeof n> => !!n && n.family === 'IPv4' && !n.internal)
    .map(n => n.address);
}
