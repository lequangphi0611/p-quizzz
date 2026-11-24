import { type APIRequestContext, expect, request, test } from '@playwright/test';
import type { TrainingEventsPage } from '../src/shared/api/index.js';
import { DESKTOP, memberContext, mentorContext, shotPath } from './helpers';

// S42: a training that runs for several days (PRODUCT.md §7.37). The server always stamps `receivedAt` with the time it
// received an event, so the older days are made by moving the timestamps in the events answer the browser gets. The day
// logic itself is covered by unit tests; this checks it is wired to the screen.
const DAY = 24 * 3600_000;
const CWD = '/home/lan/bai-tap';
const common = (sid: string) => ({ session_id: sid, transcript_path: '/home/lan/.claude/projects/x/t.jsonl', cwd: CWD, permission_mode: 'default' });
const prompt = (text: string, sid: string) => ({ ...common(sid), hook_event_name: 'UserPromptSubmit', prompt: text });
const bash = (command: string, sid: string) => ({ ...common(sid), hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command }, tool_response: { stdout: 'ok', stderr: '', interrupted: false }, duration_ms: 20 });

async function join(api: APIRequestContext, id: number, roomCode: string, name: string) {
  const joined = await api.post(`/api/trainings/${id}/join`, { data: { displayName: name, roomCode, consent: true }, headers: { 'x-forwarded-for': '10.41.0.1' } });
  expect(joined.ok()).toBeTruthy();
  const { token } = await joined.json() as { token: string };
  const cfg = await api.get('/api/training/me/hook-config', { headers: { 'x-training-member-token': token } });
  const { settings } = await cfg.json() as { settings: { hooks: { PostToolUse: { hooks: { headers: Record<string, string> }[] }[] } } };
  const ingest = settings.hooks.PostToolUse[0]!.hooks[0]!.headers['X-Training-Token']!;
  return (payload: unknown) => api.post('/api/training/ingest', { data: payload, headers: { 'X-Training-Token': ingest } });
}

test('mentor sees the day of every prompt and can jump to a day', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const page = mentor.page;
  const api = await request.newContext({ baseURL: baseURL! });

  const created = await mentor.context.request.post('/api/admin/trainings', { data: { name: 'Training nhiều ngày', allowAutoAccept: false } });
  expect(created.ok()).toBeTruthy();
  const { id, roomCode } = await created.json() as { id: number; roomCode: string };
  const send = await join(api, id, roomCode, 'Lan');
  const s1 = 'bbbb2222-0000-4000-8000-000000000001';
  for (const p of [prompt('ngày đầu: tạo dự án', s1), bash('npm init -y', s1), prompt('ngày hai: thêm test', s1), bash('npm test', s1), prompt('ngày nay: sửa lỗi', s1), bash('npm test', s1)]) expect((await send(p)).status()).toBe(204);

  // Move the first two prompts (and their commands) two and one days back.
  await page.route(/\/members\/\d+\/events/, async route => {
    const res = await route.fetch();
    const body = await res.json() as TrainingEventsPage;
    body.events.forEach((e, i) => { e.receivedAt -= i < 2 ? 2 * DAY : i < 4 ? DAY : 0; });
    await route.fulfill({ response: res, json: body });
  });

  await page.goto(`/admin/trainings/${id}`);
  await page.getByRole('button', { name: 'Lan', exact: true }).click();
  const timeline = page.getByLabel('Các sự kiện, cũ ở trên, mới ở dưới');
  await expect(timeline.getByText('ngày nay: sửa lỗi')).toBeVisible();

  // One day strip per day, oldest first, full label.
  const strips = timeline.getByRole('separator');
  await expect(strips).toHaveCount(3);
  const labels = await strips.evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
  expect(labels[0]).toMatch(/^(Thứ (Hai|Ba|Tư|Năm|Sáu|Bảy)|Chủ Nhật), \d{2}\/\d{2}\/\d{4}$/);
  expect(new Set(labels).size).toBe(3);
  await page.screenshot({ path: shotPath('S42', '1-day-strips') });

  // The picker lists the days newest first with the prompt counts, and jumps to one without filtering.
  const picker = page.getByLabel('Đi tới ngày');
  const options = await picker.locator('option').allTextContents();
  expect(options.slice(1).map(o => o.split(' · ')[1])).toEqual(['1 prompt', '1 prompt', '1 prompt']);
  await picker.selectOption({ index: 3 }); // the oldest day
  await expect(strips.first()).toBeInViewport();
  await expect(timeline.getByText('ngày hai: thêm test')).toHaveCount(1);
  await page.screenshot({ path: shotPath('S42', '2-jump-to-day') });

  // The command popup shows the day with the time of the prompt.
  await page.getByRole('button', { name: 'Xem chi tiết' }).nth(1).click();
  const popup = page.getByRole('dialog');
  await expect(popup).toBeVisible();
  await expect(popup.getByText(/^\d{2}\/\d{2} \d{2}:\d{2}$/)).toBeVisible();
  await page.screenshot({ path: shotPath('S42', '3-turn-detail') });
  await page.keyboard.press('Escape');

  // Hidden content: no picker, no prompt text.
  await page.keyboard.press('h');
  await expect(page.getByLabel('Đi tới ngày')).toHaveCount(0);
  await expect(page.getByText('ngày hai: thêm test')).toHaveCount(0);
  await page.keyboard.press('h');
  await expect(page.getByLabel('Đi tới ngày')).toBeVisible();

  // The member's consent screen says the training can last several days.
  const member = await memberContext(browser, baseURL!, DESKTOP);
  await member.page.goto('/');
  await member.page.getByLabel('Mã phòng').fill(roomCode);
  await expect(member.page).toHaveURL(new RegExp(`/training/${id}`));
  await expect(member.page.getByText('Buổi có thể kéo dài nhiều ngày.')).toBeVisible();
  await expect(member.page.getByText(/kể cả ngoài giờ học/)).toBeVisible();
  await member.page.screenshot({ path: shotPath('S42', '4-consent-multi-day'), fullPage: true });
});
