import { defineConfig } from '@playwright/test';

// E2E runs against the real app (`npm start`: vite build + Fastify serving the SPA) on its own port with an
// in-memory database, so every run starts from a clean slate. Screenshots land in docs/design/<story>-assets/.
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    locale: 'vi-VN',
  },
  webServer: {
    command: 'npm start',
    url: `http://localhost:${PORT}/api/admin/status`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { PORT: String(PORT), DB_FILE: ':memory:' },
  },
});
