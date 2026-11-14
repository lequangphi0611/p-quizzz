export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0', // 0.0.0.0 so members on the LAN can connect
  dbFile: process.env.DB_FILE ?? 'data/p-quizzz.db',
  serveWeb: process.argv.includes('--serve-web'),
};
