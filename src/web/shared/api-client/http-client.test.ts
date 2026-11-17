import { describe, expect, it, vi } from 'vitest';
import { ApiError, createHttpClient } from './http-client.js';

const respond = (status: number, body: unknown) => vi.fn(async (_url: string, _init?: RequestInit) => new Response(body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body), { status }));

describe('createHttpClient', () => {
  it('knows nothing about tokens: only Content-Type goes out by default', async () => {
    const f = respond(200, { ok: true });
    await createHttpClient({ fetch: f as unknown as typeof fetch }).post('/api/sessions/1/join', { name: 'x' });
    const init = f.mock.calls[0]![1]!;
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init).toMatchObject({ method: 'POST', body: '{"name":"x"}', credentials: 'same-origin' });
  });

  it('runs interceptors in order on a mutable request', async () => {
    const f = respond(200, {});
    const http = createHttpClient({
      fetch: f as unknown as typeof fetch,
      interceptors: [r => { r.headers['X-A'] = r.path; }, r => { r.headers['X-B'] = `${r.method}${r.headers['X-A']}`; }],
    });
    await http.get('/api/x');
    expect((f.mock.calls[0]![1]!).headers).toEqual({ 'X-A': '/api/x', 'X-B': 'GET/api/x' });
  });

  it('maps errors: { error } message, generic fallback, non-JSON body, network failure', async () => {
    const mk = (f: ReturnType<typeof respond>) => createHttpClient({ fetch: f as unknown as typeof fetch });
    await expect(mk(respond(409, { error: 'Trùng' })).get('/a')).rejects.toMatchObject({ status: 409, message: 'Trùng' });
    await expect(mk(respond(500, undefined)).get('/a')).rejects.toMatchObject({ status: 500, message: 'Lỗi 500' });
    await expect(mk(respond(502, '<html>bad gateway</html>')).get('/a')).rejects.toBeInstanceOf(ApiError);
    const down = vi.fn(async () => { throw new TypeError('fail'); });
    await expect(mk(down).get('/a')).rejects.toMatchObject({ status: 0, message: 'Không kết nối được tới máy chủ' });
  });

  it('keeps the machine-readable code the server adds next to the message', async () => {
    await expect(createHttpClient({ fetch: respond(409, { error: 'Email này đã có người vào phòng', code: 'identity_in_use' }) as unknown as typeof fetch }).post('/a')).rejects.toMatchObject({ status: 409, code: 'identity_in_use' });
    await expect(createHttpClient({ fetch: respond(409, { error: 'x' }) as unknown as typeof fetch }).post('/a')).rejects.toMatchObject({ code: undefined });
  });

  it('returns undefined for an empty success body', async () => {
    expect(await createHttpClient({ fetch: respond(204, undefined) as unknown as typeof fetch }).delete('/a')).toBeUndefined();
  });
});
