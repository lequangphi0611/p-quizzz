import { defineConfig } from '@playwright/test';
import { AI_CONFIG_PATH, writeAiConfig } from './e2e/ai-config';

// E2E runs against the real app (`npm start`: vite build + Fastify serving the SPA) on its own port with an
// in-memory database, so every run starts from a clean slate. Screenshots land in docs/design/<story>-assets/.
const PORT = Number(process.env.E2E_PORT ?? 3100);

// AI grading (S26) and example drafts (S45) run against the fake CLI, never a real AI. The config file has a fixed path (see e2e/ai-config.ts)
// so specs can rewrite it while the server runs.
writeAiConfig();

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
    env: { PORT: String(PORT), DB_FILE: ':memory:', AI_GRADER_CONFIG: AI_CONFIG_PATH },
  },
});
