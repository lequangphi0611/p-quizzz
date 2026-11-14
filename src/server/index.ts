import { networkInterfaces } from 'node:os';
import { buildApp } from './app.js';
import { config } from './config.js';
import { createDb } from './db/client.js';

const db = createDb(config.dbFile);
const app = await buildApp({ db, serveWeb: config.serveWeb, logger: true });
await app.listen({ port: config.port, host: config.host });

// Print LAN URLs so the mentor can share them with members.
const lanIps = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === 'IPv4' && !n.internal)
  .map((n) => n!.address);
const port = config.serveWeb ? config.port : 5173;
for (const ip of lanIps) console.log(`Members join at: http://${ip}:${port}`);
