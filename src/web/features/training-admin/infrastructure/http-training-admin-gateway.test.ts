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
