import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import { HttpExamLibraryGateway } from './http-exam-library-gateway.js';

describe('HttpExamLibraryGateway', () => {
  it('talks to the unchanged mentor endpoints', async () => {
    const calls: unknown[][] = [];
    const rec = (m: string) => vi.fn(async (...a: unknown[]) => { calls.push([m, ...a]); return {}; });
    const g = new HttpExamLibraryGateway({ get: rec('GET'), post: rec('POST'), delete: rec('DELETE') } as unknown as HttpClient);
    await g.previewExam('# x'); await g.importExam('# x'); await g.listExams(); await g.getExam(4); await g.deleteExam(4);
    expect(calls).toEqual([
      ['POST', '/api/admin/exams/preview', { markdown: '# x' }], ['POST', '/api/admin/exams', { markdown: '# x' }],
      ['GET', '/api/admin/exams'], ['GET', '/api/admin/exams/4'], ['DELETE', '/api/admin/exams/4'],
    ]);
  });
});
