import { type APIRequestContext, expect, request, test } from '@playwright/test';
import type { TrainingEventsPage } from '../src/shared/api/index.js';
import { DESKTOP, memberContext, mentorContext, shotPath } from './helpers';

// S42: a training that runs for several days (PRODUCT.md §7.37). The server always stamps `receivedAt` with the time it
// received an event, so the older days are made by replacing the timestamps in the events answer the browser gets (with different
// times of day, and a turn that runs past midnight). The grouping itself is covered by unit tests; this checks the screen.
const CWD = '/home/lan/bai-tap';
const common = (sid: string) => ({ session_id: sid, transcript_path: '/home/lan/.claude/projects/x/t.jsonl', cwd: CWD, permission_mode: 'default' });
const prompt = (text: string, sid: string) => ({ ...common(sid), hook_event_name: 'UserPromptSubmit', prompt: text });
const edit = (file: string, from: string, to: string, sid: string) => ({ ...common(sid), hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: `${CWD}/${file}`, old_string: from, new_string: to }, tool_response: {}, duration_ms: 6 });
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

/** A moment `daysBack` days before today, at the given local time. */
const moment = (daysBack: number, h: number, m: number) => { const d = new Date(); d.setDate(d.getDate() - daysBack); d.setHours(h, m, 0, 0); return d.getTime(); };

test('mentor sees the timeline grouped by day, newest day open, older days folded', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const page = mentor.page;
  const api = await request.newContext({ baseURL: baseURL! });

  const created = await mentor.context.request.post('/api/admin/trainings', { data: { name: 'Training nhiều ngày', allowAutoAccept: false } });
  expect(created.ok()).toBeTruthy();
  const { id, roomCode } = await created.json() as { id: number; roomCode: string };
  const send = await join(api, id, roomCode, 'Lan');
  const s1 = 'bbbb2222-0000-4000-8000-000000000001';
  const sent = [
    prompt('ngày đầu: tạo dự án', s1), bash('npm init -y', s1),
    prompt('ngày đầu: thêm README', s1), edit('src/cart.test.ts', "it('tính tổng', () => {", "it.skip('tính tổng', () => {", s1),
    prompt('ngày hai: thêm test', s1), bash('npm test', s1),
    prompt('đêm khuya: sửa lỗi', s1), bash('npm run build', s1),
    prompt('ngày nay: viết báo cáo', s1), bash('npm test', s1),
  ];
  for (const p of sent) expect((await send(p)).status()).toBe(204);

  // Three days with different times of day; the 4th prompt runs a command after midnight.
  const times = [moment(2, 9, 15), moment(2, 9, 17), moment(2, 14, 40), moment(2, 14, 41), moment(1, 8, 5), moment(1, 8, 7), moment(1, 23, 58), moment(0, 0, 3), moment(0, 10, 20), moment(0, 10, 22)];
  await page.route(/\/members\/\d+\/events/, async route => {
    const res = await route.fetch();
    const body = await res.json() as TrainingEventsPage;
    body.events.forEach((e, i) => { e.receivedAt = times[i]!; });
    await route.fulfill({ response: res, json: body });
  });

  await page.goto(`/admin/trainings/${id}`);
  await page.getByRole('button', { name: 'Lan', exact: true }).click();
  const timeline = page.getByLabel(/^Các sự kiện, ngày mới nhất ở trên/);
  await expect(timeline.getByText('ngày nay: viết báo cáo')).toBeVisible();

  // Newest day first, only the newest open; each header has the full label and the counts.
  const headers = timeline.getByRole('button', { expanded: true }).or(timeline.getByRole('button', { expanded: false }));
  await expect(headers).toHaveCount(3);
  const texts = await headers.allTextContents();
  expect(texts[0]).toMatch(/^(Thứ (Hai|Ba|Tư|Năm|Sáu|Bảy)|Chủ Nhật), \d{2}\/\d{2}\/\d{4} · 1 prompt · 1 lệnh$/);
  expect(texts[1]).toMatch(/ · 2 prompt · 2 lệnh$/); // the 23:58 prompt keeps its command of 00:03
  expect(texts[2]).toMatch(/ · 2 prompt · 2 lệnh$/);
  expect(new Set(texts).size).toBe(3);
  await expect(headers.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(headers.nth(1)).toHaveAttribute('aria-expanded', 'false');
  await expect(headers.nth(2)).toHaveAttribute('aria-expanded', 'false');
  await expect(timeline.getByText('ngày hai: thêm test')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mở tất cả' })).toBeVisible();
  await page.screenshot({ path: shotPath('S42', '1-newest-day-open') });

  // One header opens and folds its own day, with the keyboard too.
  await headers.nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(headers.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await expect(timeline.getByText('đêm khuya: sửa lỗi')).toBeVisible();
  await expect(timeline.getByText('ngày đầu: tạo dự án')).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(headers.nth(1)).toHaveAttribute('aria-expanded', 'false');
  await expect(timeline.getByText('đêm khuya: sửa lỗi')).toHaveCount(0);

  // Open all, then fold all.
  await page.getByRole('button', { name: 'Mở tất cả' }).click();
  await expect(timeline.getByText('ngày đầu: tạo dự án')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thu tất cả' })).toBeVisible();
  await page.screenshot({ path: shotPath('S42', '2-all-open') });

  // The command popup shows the day with the time of the prompt.
  await page.getByRole('button', { name: 'Xem chi tiết' }).nth(2).click();
  const popup = page.getByRole('dialog');
  await expect(popup).toBeVisible();
  await expect(popup.getByText(/^\d{2}\/\d{2} 23:58$/)).toBeVisible();
  await page.screenshot({ path: shotPath('S42', '3-turn-detail') });
  await page.keyboard.press('Escape');

  // A flag chip to a command of a folded day opens that day and its popup.
  await page.getByRole('button', { name: 'Thu tất cả' }).click();
  await expect(headers.nth(2)).toHaveAttribute('aria-expanded', 'false');
  await page.getByLabel('Cờ gợi ý').getByRole('button', { name: /Đụng vào test/ }).click();
  await expect(headers.nth(2)).toHaveAttribute('aria-expanded', 'true');
  await expect(headers.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('src/cart.test.ts')).toBeVisible();
  await page.keyboard.press('Escape');

  // Narrow window.
  await page.setViewportSize({ width: 800, height: 900 });
  await page.getByRole('button', { name: 'Mở tất cả' }).click();
  await page.screenshot({ path: shotPath('S42', '5-narrow') });
  await page.setViewportSize(DESKTOP);

  // Hidden content: no prompt, no day header, no summary, no open-all button.
  await page.keyboard.press('h');
  await expect(page.getByText('ngày hai: thêm test')).toHaveCount(0);
  await expect(timeline.getByRole('button', { expanded: true }).or(timeline.getByRole('button', { expanded: false }))).toHaveCount(0);
  await expect(page.getByText(/ · \d+ prompt/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Mở tất cả|Thu tất cả/ })).toHaveCount(0);
  await page.keyboard.press('h');
  await expect(headers).toHaveCount(3);

  // The member's consent screen says the training can last several days.
  const member = await memberContext(browser, baseURL!, DESKTOP);
  await member.page.goto('/');
  await member.page.getByLabel('Mã phòng').fill(roomCode);
  await expect(member.page).toHaveURL(new RegExp(`/training/${id}`));
  const item = member.page.getByText('Buổi có thể kéo dài nhiều ngày.');
  await item.scrollIntoViewIfNeeded();
  await expect(item).toBeVisible();
  await expect(member.page.getByText(/kể cả ngoài giờ học/)).toBeVisible();
  await member.page.screenshot({ path: shotPath('S42', '4-consent-multi-day') });
});
