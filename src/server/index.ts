import { buildApp } from './app.js';
import { config } from './config.js';
import { createDb } from './infrastructure/db/client.js';
import { lanIPv4 } from './infrastructure/system/network.js';

const db = createDb(config.dbFile);
const app = await buildApp({ db, serveWeb: config.serveWeb, logger: true, allowRemoteAdmin: config.allowRemoteAdmin });
await app.listen({ port: config.port, host: config.host });

// Print LAN URLs so the mentor can share them with members.
const port = config.serveWeb ? config.port : 5173;
for (const ip of lanIPv4()) console.log(`Members join at: http://${ip}:${port}`);
console.log(
  config.allowRemoteAdmin
    ? 'CẢNH BÁO: trang quản trị mở cho mọi máy trong mạng (--allow-remote-admin / ALLOW_REMOTE_ADMIN).'
    : `Trang quản trị (chỉ máy này): http://localhost:${port}/admin/login`,
);
