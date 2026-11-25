import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '../../../shared/api-client/http-client.js';
import { HttpTrainingAdminGateway } from './http-training-admin-gateway.js';

describe('HttpTrainingAdminGateway', () => {
  it('calls the admin training endpoints', async () => {
    const f = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ joinHosts: ['h:1'] }), { status: 200 }));
    const g = new HttpTrainingAdminGateway(createHttpClient({ fetch: f as unknown as typeof fetch }));
    await g.list();
    await g.create('Buổi 1');
    await g.get(3);
    await g.stop(3);
    await g.end(3);
    await g.removeMember(3, 8);
    await g.events(3, 8);
    await g.events(3, 8, 41);
    await g.eventDetail(3, 99);
    expect(await g.getJoinHosts()).toEqual(['h:1']);
    expect(f.mock.calls.map(c => [(c[1] as RequestInit).method, c[0]])).toEqual([
      ['GET', '/api/admin/trainings'], ['POST', '/api/admin/trainings'], ['GET', '/api/admin/trainings/3'],
      ['POST', '/api/admin/trainings/3/stop'], ['POST', '/api/admin/trainings/3/end'], ['DELETE', '/api/admin/trainings/3/members/8'],
      ['GET', '/api/admin/trainings/3/members/8/events'], ['GET', '/api/admin/trainings/3/members/8/events?after=41'],
      ['GET', '/api/admin/trainings/3/events/99/detail'], ['GET', '/api/network'],
    ]);
    expect(JSON.parse((f.mock.calls[1]![1] as RequestInit).body as string)).toEqual({ name: 'Buổi 1', allowAutoAccept: false });
    await g.create('Buổi 2', { allowAutoAccept: true });
    expect(JSON.parse((f.mock.calls[10]![1] as RequestInit).body as string)).toEqual({ name: 'Buổi 2', allowAutoAccept: true });
  });

  it('marks, notes and the report (S40): the right verbs and paths, and the file comes back as text', async () => {
    const f = vi.fn(async (url: string, _init?: RequestInit) => (url.includes('report.md') ? new Response('# Báo cáo\n- 1/2 bạn', { status: 200 }) : new Response(null, { status: 204 })));
    const g = new HttpTrainingAdminGateway(createHttpClient({ fetch: f as unknown as typeof fetch }));
    await g.mark(3, 41, true);
    await g.mark(3, 41, false);
    await g.saveNote(3, 8, 'Nhắc chạy test');
    expect(await g.reportPreview(3)).toBe('# Báo cáo\n- 1/2 bạn');
    expect(await g.exportReport(3)).toBe('# Báo cáo\n- 1/2 bạn');
    expect(f.mock.calls.map(c => [(c[1] as RequestInit).method, c[0]])).toEqual([
      ['PUT', '/api/admin/trainings/3/events/41/mark'], ['DELETE', '/api/admin/trainings/3/events/41/mark'],
      ['PUT', '/api/admin/trainings/3/members/8/note'],
      ['GET', '/api/admin/trainings/3/report.md?preview=1'], ['GET', '/api/admin/trainings/3/report.md'],
    ]);
    expect(JSON.parse((f.mock.calls[2]![1] as RequestInit).body as string)).toEqual({ note: 'Nhắc chạy test' });
  });

  it('teaching examples (S44): the right verbs and paths; review marks, and the file comes back as text', async () => {
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('teaching-examples')) return new Response(JSON.stringify({ examples: [{ eventId: 4 }] }), { status: 200 });
      if (url.includes('teaching-examples.md')) return new Response('# Ví dụ', { status: 200 });
      return init?.method === 'DELETE' ? new Response(null, { status: 204 }) : new Response(JSON.stringify({ eventId: 4 }), { status: 200 });
    });
    const g = new HttpTrainingAdminGateway(createHttpClient({ fetch: f as unknown as typeof fetch }));
    const body = { label: 'good' as const, topic: 'other' as const, comment: 'ok', betterPrompt: null, editedPrompt: null, editedContext: null };
    await g.saveTeachingExample(3, 4, body);
    await g.deleteTeachingExample(3, 4);
    await g.setTeachingReviewed(3, 4, true);
    await g.setTeachingReviewed(3, 4, false);
    expect(await g.teachingExamples(3)).toEqual([{ eventId: 4 }]);
    expect(await g.exportTeachingExamples(3)).toBe('# Ví dụ');
    expect(f.mock.calls.map(c => [(c[1] as RequestInit).method, c[0]])).toEqual([
      ['PUT', '/api/admin/trainings/3/events/4/teaching-example'], ['DELETE', '/api/admin/trainings/3/events/4/teaching-example'],
      ['PUT', '/api/admin/trainings/3/events/4/teaching-example/reviewed'], ['DELETE', '/api/admin/trainings/3/events/4/teaching-example/reviewed'],
      ['GET', '/api/admin/trainings/3/teaching-examples'], ['GET', '/api/admin/trainings/3/teaching-examples.md'],
    ]);
    expect(JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string)).toEqual(body);
  });

  it('a failed report still reports the server message', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: 'Buổi training đã kết thúc, dữ liệu đã bị xoá' }), { status: 409 }));
    const g = new HttpTrainingAdminGateway(createHttpClient({ fetch: f as unknown as typeof fetch }));
    await expect(g.exportReport(3)).rejects.toMatchObject({ status: 409, message: 'Buổi training đã kết thúc, dữ liệu đã bị xoá' });
  });

  it('exports the raw data (S41): the query carries only what was chosen, the zip comes back as a Blob', async () => {
    const summary = { from: '2026-11-24', to: '2026-11-24', memberCount: 2, eventCount: 9, approxBytes: 2048, tooLarge: false };
    const f = vi.fn(async (url: string, _init?: RequestInit) => (url.includes('export.zip') ? new Response(new Uint8Array([0x50, 0x4b]), { status: 200 }) : new Response(JSON.stringify(summary), { status: 200 })));
    const g = new HttpTrainingAdminGateway(createHttpClient({ fetch: f as unknown as typeof fetch }));
    expect(await g.exportSummary(3, { memberIds: null })).toEqual(summary);
    await g.exportSummary(3, { from: '2026-11-23', memberIds: null });
    await g.exportSummary(3, { from: '2026-11-22', to: '2026-11-24', memberIds: [8, 9] });
    expect(await g.exportData(3, { from: '2026-11-22', to: '2026-11-24', memberIds: [8] })).toBeInstanceOf(Blob);
    expect(f.mock.calls.map(c => [(c[1] as RequestInit).method, c[0]])).toEqual([
      ['GET', '/api/admin/trainings/3/export/summary'],
      ['GET', '/api/admin/trainings/3/export/summary?from=2026-11-23'],
      ['GET', '/api/admin/trainings/3/export/summary?from=2026-11-22&to=2026-11-24&members=8,9'],
      ['GET', '/api/admin/trainings/3/export.zip?from=2026-11-22&to=2026-11-24&members=8'],
    ]);
  });

  it('a refused export still reports the server message', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: 'Không có dữ liệu trong khoảng này' }), { status: 404 }));
    const g = new HttpTrainingAdminGateway(createHttpClient({ fetch: f as unknown as typeof fetch }));
    await expect(g.exportData(3, { memberIds: null })).rejects.toMatchObject({ status: 404, message: 'Không có dữ liệu trong khoảng này' });
  });

  describe('the "hide content" choice', () => {
    const http = createHttpClient({ fetch: vi.fn() as unknown as typeof fetch });
    const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

    it('is remembered in the browser storage', () => {
      const storage = memory();
      const g = new HttpTrainingAdminGateway(http, storage);
      expect(g.readHideContent()).toBe(false);
      g.writeHideContent(true);
      expect(g.readHideContent()).toBe(true);
      expect(new HttpTrainingAdminGateway(http, storage).readHideContent()).toBe(true); // survives a reload
      g.writeHideContent(false);
      expect(g.readHideContent()).toBe(false);
    });

    it('works without storage, or when the storage throws', () => {
      const none = new HttpTrainingAdminGateway(http, null);
      none.writeHideContent(true);
      expect(none.readHideContent()).toBe(false);
      const broken = new HttpTrainingAdminGateway(http, { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
      expect(() => broken.writeHideContent(true)).not.toThrow();
      expect(broken.readHideContent()).toBe(false);
    });
  });
});
