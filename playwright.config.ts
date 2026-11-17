import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

// E2E runs against the real app (`npm start`: vite build + Fastify serving the SPA) on its own port with an
// in-memory database, so every run starts from a clean slate. Screenshots land in docs/design/<story>-assets/.
const PORT = Number(process.env.E2E_PORT ?? 3100);

// AI grading (S26) runs against the fake CLI, never a real AI. Its config needs absolute paths: the CLI runs in a temp dir.
const AI_CONFIG = join(mkdtempSync(join(tmpdir(), 'pq-e2e-ai-')), 'ai-grader.json');
writeFileSync(AI_CONFIG, JSON.stringify({
  command: process.execPath,
  args: [resolve('src/server/infrastructure/ai-grader/testing/fake-claude-cli.mjs'), '--fake-mode', 'slow', '--fake-delay', '700'],
  maxAnswerChars: 1000,
}));

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
    env: { PORT: String(PORT), DB_FILE: ':memory:', AI_GRADER_CONFIG: AI_CONFIG },
  },
});
