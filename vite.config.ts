/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';

// Frontend root is src/web. In dev, Vite proxies /api to the Fastify server.
export default defineConfig({
  root: 'src/web',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../../dist/web', emptyOutDir: true },
  server: {
    host: true,
    port: 5173,
    // The dev server listens on the LAN, and by default also serves ANY file under the repo via /@fs/ —
    // including exams/ (answers) and data/ (the database). Only the sources the app is built from may be served.
    fs: {
      strict: true,
      allow: [resolve('src/web'), resolve('src/shared'), resolve('node_modules')],
      deny: ['**/exams/**', '**/data/**', '**/*.db', '**/*.db-*', '**/*.sqlite', '**/docs/**', '.env', '.env.*', '*.{crt,pem}', '**/.git/**'],
    },
    // xfwd passes the browser's real IP to the server, which uses it to keep /api/admin/* mentor-machine-only.
    proxy: { '/api': { target: 'http://localhost:3000', xfwd: true } },
  },
  test: { root: '.', include: ['src/**/*.test.ts'] },
});
