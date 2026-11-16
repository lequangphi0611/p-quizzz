export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0', // 0.0.0.0 so members on the LAN can connect
  dbFile: process.env.DB_FILE ?? 'data/p-quizzz.db',
  serveWeb: process.argv.includes('--serve-web'),
  // By default /api/admin/* answers only on the mentor's own machine. Opt in to remote admin with the flag or env.
  allowRemoteAdmin: process.argv.includes('--allow-remote-admin') || process.env.ALLOW_REMOTE_ADMIN === '1',
};
