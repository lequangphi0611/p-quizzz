/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Frontend root is src/web. In dev, Vite proxies /api to the Fastify server.
export default defineConfig({
  root: 'src/web',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../../dist/web', emptyOutDir: true },
  server: {
    host: true,
    port: 5173,
    // xfwd passes the browser's real IP to the server, which uses it to keep /api/admin/* mentor-machine-only.
    proxy: { '/api': { target: 'http://localhost:3000', xfwd: true } },
  },
  test: { root: '.', include: ['src/**/*.test.ts'] },
});
