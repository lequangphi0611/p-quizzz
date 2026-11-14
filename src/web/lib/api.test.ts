import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, getParticipantToken, setParticipantToken } from './api.js';

function stubStorage() {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) });
}
function stubFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}
const headersOf = (fn: ReturnType<typeof vi.fn>) => ((fn.mock.calls[0] as unknown[])[1] as RequestInit).headers as Record<string, string>;

beforeEach(stubStorage);
afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('returns parsed JSON on success', async () => {
    stubFetch(200, { status: 'ok' });
    expect(await api.get('/api/health')).toEqual({ status: 'ok' });
  });

  it('throws ApiError with status and message from { error }', async () => {
    stubFetch(409, { error: 'Tên đã được dùng' });
    const err = await api.post('/api/sessions/1/join', { name: 'x' }).catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, message: 'Tên đã được dùng' });
  });

  it('falls back to a generic message when the body has no { error }', async () => {
    stubFetch(500, undefined);
    await expect(api.get('/api/x')).rejects.toMatchObject({ status: 500, message: 'Lỗi 500' });
  });

  it('throws ApiError(0) when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fail'); }));
    await expect(api.get('/api/x')).rejects.toMatchObject({ status: 0 });
  });

  it('attaches X-Participant-Token only for the matching session', async () => {
    setParticipantToken(1, 'tok-1');
    setParticipantToken(2, 'tok-2');
    let fn = stubFetch(200, {});
    await api.get('/api/sessions/2/me');
    expect(headersOf(fn)['X-Participant-Token']).toBe('tok-2');

    fn = stubFetch(200, {});
    await api.get('/api/sessions/3/me'); // no token stored for session 3
    expect(headersOf(fn)['X-Participant-Token']).toBeUndefined();

    fn = stubFetch(200, {});
    await api.get('/api/exams'); // not a session path
    expect(headersOf(fn)['X-Participant-Token']).toBeUndefined();
  });

  it('sends JSON bodies with the right method', async () => {
    const fn = stubFetch(200, {});
    await api.patch('/api/x', { a: 1 });
    const init = (fn.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('token helpers survive missing/throwing localStorage', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(() => setParticipantToken(1, 't')).not.toThrow();
    expect(getParticipantToken(1)).toBeNull();
  });
});
