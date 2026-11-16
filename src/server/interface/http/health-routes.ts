import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '../../../shared/api/index.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async (): Promise<HealthResponse> => ({ status: 'ok', version: '0.1.0' }));
}
