/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Frontend root is src/web. In dev, Vite proxies /api to the Fastify server.
export default defineConfig({
  root: 'src/web',
  plugins: [react()],
  build: { outDir: '../../dist/web', emptyOutDir: true },
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: { root: '.', include: ['src/**/*.test.ts'] },
});
