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

  it('adds a call\'s own headers after the interceptors, for every verb', async () => {
    const f = respond(200, {});
    const http = createHttpClient({ fetch: f as unknown as typeof fetch, interceptors: [r => { r.headers['X-A'] = 'a'; }] });
    await http.get('/a', { headers: { 'X-Own': '1' } });
    await http.post('/a', { x: 1 }, { headers: { 'X-Own': '2' } });
    await http.delete('/a', undefined, { headers: { 'X-Own': '3', 'X-A': 'override' } });
    expect(f.mock.calls.map(c => c[1]!.headers)).toEqual([
      { 'X-A': 'a', 'X-Own': '1' },
      { 'X-A': 'a', 'Content-Type': 'application/json', 'X-Own': '2' },
      { 'X-A': 'override', 'X-Own': '3' },
    ]);
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

  it('returns a binary answer as a Blob when asked, and still reads an error as { error }', async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 255]);
    const ok = createHttpClient({ fetch: vi.fn(async () => new Response(zip, { status: 200 })) as unknown as typeof fetch });
    const blob = await ok.get<Blob>('/x.zip', { as: 'blob' });
    expect(blob).toBeInstanceOf(Blob);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(zip);

    const failing = createHttpClient({ fetch: vi.fn(async () => new Response(JSON.stringify({ error: 'Không có dữ liệu trong khoảng này', code: 'empty_export' }), { status: 404 })) as unknown as typeof fetch });
    await expect(failing.get('/x.zip', { as: 'blob' })).rejects.toMatchObject({ status: 404, message: 'Không có dữ liệu trong khoảng này', code: 'empty_export' });
  });
});
