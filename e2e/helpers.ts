import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { type APIRequestContext, type Browser, type BrowserContext, type Page, expect } from '@playwright/test';

export const MENTOR_PASSWORD = 'e2e-password';
const EXAM_FILE = resolve('exams/examples/git-co-ban.md');

/** Where a story's screenshots go (committed; reviewed by the designer like S19). */
export function shotPath(story: string, name: string): string {
  const dir = resolve('docs/design', `${story}-assets`);
  mkdirSync(dir, { recursive: true });
  return resolve(dir, `${name}.png`);
}

export const DESKTOP = { width: 1440, height: 900 };
export const LAPTOP = { width: 1280, height: 720 };
export const PHONE = { width: 390, height: 844 };

/** Signed-in mentor context (the admin API only answers on the machine running the app, which is localhost here). */
export async function mentorContext(browser: Browser, baseURL: string, viewport = DESKTOP): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL, viewport, deviceScaleFactor: 2, locale: 'vi-VN' });
  const page = await context.newPage();
  const status = await (await context.request.get('/api/admin/status')).json() as { setupDone: boolean };
  const res = await context.request.post(status.setupDone ? '/api/admin/login' : '/api/admin/setup', { data: { password: MENTOR_PASSWORD } });
  expect(res.ok(), 'mentor setup/login').toBeTruthy();
  return { context, page };
}

/** Imports an exam (the bundled example by default) and returns its id (an exam can be imported many times, see PRODUCT §7.10). */
export async function importExam(api: APIRequestContext, file = EXAM_FILE): Promise<number> {
  const markdown = readFileSync(file, 'utf-8');
  const res = await api.post('/api/admin/exams', { data: { markdown } });
  expect(res.ok(), 'exam import').toBeTruthy();
  return ((await res.json()) as { exam: { id: number } }).exam.id;
}

export interface MadeSession { id: number; roomCode: string }

/** Creates a session and moves it through the given transitions. `extra` is merged into the create body. */
export async function makeSession(api: APIRequestContext, examId: number, opts: { steps?: Array<'open' | 'start'>; extra?: Record<string, unknown> } = {}): Promise<MadeSession> {
  const created = await api.post('/api/admin/sessions', { data: { examId, autoApprove: true, ...opts.extra } });
  expect(created.ok(), 'create session').toBeTruthy();
  const { id } = (await created.json()) as { id: number };
  for (const step of opts.steps ?? ['open']) {
    const r = await api.post(`/api/admin/sessions/${id}/${step}`);
    expect(r.ok(), `session ${step}`).toBeTruthy();
  }
  const detail = await (await api.get(`/api/admin/sessions/${id}`)).json() as { roomCode: string | null };
  return { id, roomCode: detail.roomCode ?? '' };
}

let nextDevice = 1;

/**
 * A fresh, isolated member browser (own localStorage, like another person's device). Every device also gets its own
 * address (the server trusts X-Forwarded-For from this machine), because wrong room codes are limited per address:
 * without it the tests that guess codes on purpose would lock out every later test of the run.
 */
export async function memberContext(browser: Browser, baseURL: string, viewport = DESKTOP): Promise<{ context: BrowserContext; page: Page }> {
  const n = nextDevice++;
  const context = await browser.newContext({ baseURL, viewport, deviceScaleFactor: 2, locale: 'vi-VN', extraHTTPHeaders: { 'x-forwarded-for': `10.20.${n >> 8}.${n & 255}` } });
  return { context, page: await context.newPage() };
}
