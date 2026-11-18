import { buildApp } from './app.js';
import { config } from './config.js';
import { compose } from './composition.js';
import { createDb } from './infrastructure/db/client.js';
import { startDeadlineWatcher } from './infrastructure/system/deadline-watcher.js';
import { lanIPv4 } from './infrastructure/system/network.js';

const db = createDb(config.dbFile);
// Unexpected AI grading failures are logged without the configuration (it never reaches an error message).
const composition = compose(db, {}, { onError: err => console.error('AI grading:', err instanceof Error ? err.message : err) });
const app = await buildApp({ db, composition, serveWeb: config.serveWeb, logger: true, allowRemoteAdmin: config.allowRemoteAdmin });
// AI suggestions left queued/running by a previous run cannot finish any more (PRODUCT.md §7.28h).
await composition.ai.failUnfinished.execute();
await app.listen({ port: config.port, host: config.host });
// Sessions with a time limit close themselves when the clock runs out (PRODUCT.md §7.27f).
startDeadlineWatcher(composition.sessions.closeExpired, 1000, err => app.log.error(err));
// Sessions start themselves at the scheduled time or once everyone is ready; a start missed while off is dropped (§7.31).
startDeadlineWatcher(composition.sessions.startDue, 1000, err => app.log.error(err));

// Print LAN URLs so the mentor can share them with members.
const port = config.serveWeb ? config.port : 5173;
for (const ip of lanIPv4()) console.log(`Members join at: http://${ip}:${port}`);
console.log(
  config.allowRemoteAdmin
    ? 'CẢNH BÁO: trang quản trị mở cho mọi máy trong mạng (--allow-remote-admin / ALLOW_REMOTE_ADMIN).'
    : `Trang quản trị (chỉ máy này): http://localhost:${port}/admin/login`,
);
