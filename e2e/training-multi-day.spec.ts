import { type APIRequestContext, type Locator, type Page, expect, request, test } from '@playwright/test';
import type { TrainingEventsPage } from '../src/shared/api/index.js';
import { DESKTOP, memberContext, mentorContext, shotPath } from './helpers';

// S42: a training that runs for several days (PRODUCT.md §7.37), with the design of the designer (docs/design/S42-design).
// The server always stamps `receivedAt` with the time it received an event, so the older days are made by replacing the
// timestamps in the events answer the browser gets (with different times of day, a turn that runs past midnight and a Claude
// Code session that runs across days). The grouping itself is covered by unit tests; this checks the screen.
const CWD = '/home/lan/bai-tap';
const common = (sid: string) => ({ session_id: sid, transcript_path: '/home/lan/.claude/projects/x/t.jsonl', cwd: CWD, permission_mode: 'default' });
const prompt = (text: string, sid: string) => ({ ...common(sid), hook_event_name: 'UserPromptSubmit', prompt: text });
const edit = (file: string, from: string, to: string, sid: string) => ({ ...common(sid), hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: `${CWD}/${file}`, old_string: from, new_string: to }, tool_response: {}, duration_ms: 6 });
const bash = (command: string, sid: string) => ({ ...common(sid), hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command }, tool_response: { stdout: 'ok', stderr: '', interrupted: false }, duration_ms: 20 });

async function join(api: APIRequestContext, id: number, roomCode: string, name: string, ip: string) {
  const joined = await api.post(`/api/trainings/${id}/join`, { data: { displayName: name, roomCode, consent: true }, headers: { 'x-forwarded-for': ip } });
  expect(joined.ok()).toBeTruthy();
  const { token } = await joined.json() as { token: string };
  const cfg = await api.get('/api/training/me/hook-config', { headers: { 'x-training-member-token': token } });
  const { settings } = await cfg.json() as { settings: { hooks: { PostToolUse: { hooks: { headers: Record<string, string> }[] }[] } } };
  const ingest = settings.hooks.PostToolUse[0]!.hooks[0]!.headers['X-Training-Token']!;
  return (payload: unknown) => api.post('/api/training/ingest', { data: payload, headers: { 'X-Training-Token': ingest } });
}

/** A moment `daysBack` days before today, at the given local time. */
const moment = (daysBack: number, h: number, m: number) => { const d = new Date(); d.setDate(d.getDate() - daysBack); d.setHours(h, m, 0, 0); return d.getTime(); };

const box = async (l: Locator) => (await l.boundingBox())!;
const frame = (page: Page) => page.getByLabel(/^Các sự kiện, ngày mới nhất ở trên/);
const dayButtons = (page: Page) => frame(page).locator('button[id^="day-"][aria-expanded]');

test('mentor reads a training of several days: day groups, flags, sticky header, reading position, hiding', async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const page = mentor.page;
  await page.emulateMedia({ reducedMotion: 'reduce' }); // no fade-in or flash while a screenshot is taken
  const api = await request.newContext({ baseURL: baseURL! });

  const created = await mentor.context.request.post('/api/admin/trainings', { data: { name: 'Training nhiều ngày', allowAutoAccept: false } });
  expect(created.ok()).toBeTruthy();
  const { id, roomCode } = await created.json() as { id: number; roomCode: string };
  const send = await join(api, id, roomCode, 'Lan', '10.41.0.1');
  const sendMinh = await join(api, id, roomCode, 'Minh', '10.41.0.2');
  const detail = await (await mentor.context.request.get(`/api/admin/trainings/${id}`)).json() as { members: { id: number; displayName: string }[] };
  const lanId = detail.members.find(m => m.displayName === 'Lan')!.id;

  const s1 = 'bbbb2222-0000-4000-8000-000000000001';
  const s2 = 'bbbb2222-0000-4000-8000-000000000002';
  // [event, when]: 2 days ago (2 prompts), yesterday (7 prompts; the last runs a command after midnight; a second session opens at night),
  // today (2 prompts; the second session goes on).
  const plan: [unknown, number][] = [
    [prompt('ngày đầu: tạo dự án', s1), moment(2, 9, 15)], [bash('npm init -y', s1), moment(2, 9, 17)],
    [prompt('ngày đầu: thêm README', s1), moment(2, 14, 40)], [edit('src/cart.test.ts', "it('tính tổng', () => {", "it.skip('tính tổng', () => {", s1), moment(2, 14, 41)],
    [prompt('ngày hai: thêm test', s1), moment(1, 8, 5)], [bash('npm test', s1), moment(1, 8, 7)],
    [prompt('ngày hai: sửa cấu hình', s1), moment(1, 9, 30)],
    [prompt('ngày hai: viết thêm test', s1), moment(1, 11, 0)],
    [prompt('ngày hai: chạy lại', s1), moment(1, 13, 15)], [bash('npm test', s1), moment(1, 13, 16)],
    [prompt('ngày hai: dọn code', s1), moment(1, 15, 20)],
    [prompt('đêm khuya: sửa lỗi', s2), moment(1, 22, 10)],
    [prompt('đêm khuya: viết lại test', s2), moment(1, 23, 58)], [bash('npm run build', s2), moment(0, 0, 3)],
    [prompt('ngày nay: viết báo cáo', s2), moment(0, 10, 20)], [bash('npm test', s2), moment(0, 10, 22)],
    [prompt('ngày nay: xem lại', s2), moment(0, 10, 40)],
  ];
  for (const [p] of plan) expect((await send(p)).status()).toBe(204);
  expect((await sendMinh(prompt('Minh: một prompt', s1))).status()).toBe(204);
  expect((await sendMinh(bash('ls', s1))).status()).toBe(204);

  // Lan's events get the planned times, in the order they were first seen (events that arrive later keep their real, current time).
  const stamped = new Map<number, number>();
  await page.route(new RegExp(`/members/${lanId}/events`), async route => {
    const res = await route.fetch();
    const body = await res.json() as TrainingEventsPage;
    for (const e of body.events) {
      if (!stamped.has(e.id) && stamped.size < plan.length) stamped.set(e.id, plan[stamped.size]![1]);
      e.receivedAt = stamped.get(e.id) ?? e.receivedAt;
    }
    await route.fulfill({ response: res, json: body });
  });

  await page.goto(`/admin/trainings/${id}`);
  await page.getByRole('button', { name: 'Lan', exact: true }).click();
  const timeline = frame(page);
  await expect(timeline.getByText('ngày nay: xem lại')).toBeVisible();

  // Three days, newest first; only the newest is open; today carries the badge; the counts are in the accessible name.
  const heads = dayButtons(page);
  await expect(heads).toHaveCount(3);
  await expect(heads.nth(0)).toHaveAccessibleName(/, hôm nay, 2 prompt, 1 lệnh$/);
  await expect(heads.nth(1)).toHaveAccessibleName(/, 7 prompt, 3 lệnh$/); // the command of 00:03 stays with the prompt of 23:58
  await expect(heads.nth(2)).toHaveAccessibleName(/, 2 prompt, 2 lệnh$/);
  await expect(timeline.getByText('Hôm nay', { exact: true })).toHaveCount(1);
  await expect(heads.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(heads.nth(1)).toHaveAttribute('aria-expanded', 'false');
  await expect(heads.nth(2)).toHaveAttribute('aria-expanded', 'false');
  await expect(timeline.getByText('ngày hai: thêm test')).toHaveCount(0);
  // The folded day has the chip of its flag as its own button next to the header button, never inside it.
  const chip = timeline.getByRole('button', { name: /Đụng vào test/ });
  await expect(chip).toHaveCount(1);
  expect(await heads.nth(2).locator('button').count()).toBe(0);
  // "Mở tất cả" sits on the member's row, with the name; there is no row of its own.
  const toggle = page.getByRole('button', { name: 'Mở tất cả' });
  await expect(toggle).toBeVisible();
  const name = await box(page.getByRole('heading', { name: 'Lan', exact: true }));
  const toggleBox = await box(toggle);
  expect(Math.abs((toggleBox.y + toggleBox.height / 2) - (name.y + name.height / 2))).toBeLessThan(24);
  await page.screenshot({ path: shotPath('S42', '1-default') });

  // Tab order: day header, then its chip, then the rows.
  await heads.nth(2).focus();
  await page.keyboard.press('Tab');
  await expect(chip).toBeFocused();

  // The chip of the folded day opens it and goes to the evidence (a command: its popup).
  await chip.click();
  await expect(heads.nth(2)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('dialog').getByText('src/cart.test.ts')).toBeVisible();
  await page.screenshot({ path: shotPath('S42', '6-flag-chip') });
  await page.keyboard.press('Escape');
  await heads.nth(2).click();
  await expect(heads.nth(2)).toHaveAttribute('aria-expanded', 'false');

  // One header opens and folds its own day, with the keyboard too.
  await heads.nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(heads.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await expect(timeline.getByText('đêm khuya: sửa lỗi')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(heads.nth(1)).toHaveAttribute('aria-expanded', 'false');
  await expect(timeline.getByText('đêm khuya: sửa lỗi')).toHaveCount(0);

  // Narrow window: the header wraps (summary under the label), nothing spills sideways.
  await page.setViewportSize({ width: 800, height: 900 });
  await page.screenshot({ path: shotPath('S42', '2-narrow-800') });
  const stacked = await heads.nth(2).evaluate(el => { const [a, b] = Array.from(el.querySelectorAll('span[aria-hidden] > span')).map(n => n.getBoundingClientRect()); return b!.top >= a!.bottom - 1; });
  const scrolled = await timeline.evaluate(el => el.scrollWidth <= el.clientWidth);
  expect(scrolled).toBe(true);
  expect(stacked).toBe(true); // the summary is under the label
  await page.setViewportSize(DESKTOP);

  // Open all: the sessions are blocks of their day (S43); a session that runs past midnight is in the next day too, with "tiếp từ".
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Thu tất cả' })).toBeVisible();
  await expect(timeline.getByText('Phiên Claude Code 2', { exact: true })).toHaveCount(2); // yesterday night (a block) and today (the only one that day: a plain line)
  await expect(timeline.getByText('Phiên Claude Code 1', { exact: true })).toHaveCount(2); // the first day (plain) and yesterday (a block)
  await expect(timeline.getByText(/^tiếp từ \d\d\/\d\d$/)).toHaveCount(2);
  await expect(timeline.getByText('22:10–00:03', { exact: false })).toBeVisible();

  // The header of the open day is pinned while it is read (and the one before it is gone); folding it from there brings it to the top.
  const yesterday = timeline.locator('[data-day-group]').nth(1);
  const yesterdayKey = (await yesterday.getAttribute('data-day-group'))!;
  await timeline.evaluate((el, key) => {
    const g = el.querySelector(`[data-day-group="${key}"]`)!;
    el.scrollTop += g.getBoundingClientRect().top - el.getBoundingClientRect().top + 220;
  }, yesterdayKey);
  const pinned = page.locator(`#day-${yesterdayKey}-row`);
  await expect(pinned).toHaveAttribute('data-pinned', 'true');
  expect(Math.abs((await box(pinned)).y - (await box(timeline)).y)).toBeLessThan(2);
  await expect(heads.nth(0)).not.toBeInViewport();
  await page.screenshot({ path: shotPath('S42', '3-all-sticky') });

  // New events while reading an older day: what is read stays put and the chip is on the edge of the side the events are on.
  const reading = timeline.getByText('ngày hai: viết thêm test');
  await expect(reading).toBeInViewport();
  const before = (await box(reading)).y;
  expect((await send(prompt('ngày nay: prompt mới', s2))).status()).toBe(204);
  const newChip = page.locator('[data-unread-chip]');
  await expect(newChip).toBeVisible();
  await expect(newChip).toHaveAttribute('data-side', 'above');
  expect(Math.abs((await box(reading)).y - before)).toBeLessThan(2);
  expect(Math.abs((await box(newChip)).y - (await box(timeline)).y)).toBeLessThan(70); // on the top edge, under the pinned header
  await page.screenshot({ path: shotPath('S42', '7-new-events') });

  // The chip goes to the newest event.
  await newChip.click();
  await expect(timeline.getByText('ngày nay: prompt mới')).toBeInViewport();
  await expect(newChip).toHaveCount(0);

  // Folding a pinned day brings its header to the top of the frame (there is enough below it to scroll to).
  const todayKey = (await timeline.locator('[data-day-group]').first().getAttribute('data-day-group'))!;
  await timeline.evaluate((el, key) => {
    const g = el.querySelector(`[data-day-group="${key}"]`)!;
    el.scrollTop += g.getBoundingClientRect().top - el.getBoundingClientRect().top + 150;
  }, todayKey);
  const todayRow = page.locator(`#day-${todayKey}-row`);
  await expect(todayRow).toHaveAttribute('data-pinned', 'true');
  await todayRow.getByRole('button').first().click();
  await expect(todayRow.getByRole('button').first()).toHaveAttribute('aria-expanded', 'false');
  expect(Math.abs((await box(todayRow)).y - (await box(timeline)).y)).toBeLessThan(2);
  await todayRow.getByRole('button').first().click();
  await expect(todayRow.getByRole('button').first()).toHaveAttribute('aria-expanded', 'true');

  // The command popup shows the day with the time of the prompt.
  await page.getByRole('button', { name: 'Xem chi tiết' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/^\d{2}\/\d{2} \d{2}:\d{2}$/)).toBeVisible();
  await page.screenshot({ path: shotPath('S42', '9-turn-detail') });
  await page.keyboard.press('Escape');

  // Hidden content: no prompt, no day header, no summary, no open-all button; showing it again keeps the days and the scroll position.
  await timeline.evaluate(el => { el.scrollTop = 300; });
  const openBefore = await heads.evaluateAll(els => els.map(e => e.getAttribute('aria-expanded')));
  const top = await timeline.evaluate(el => el.scrollTop);
  await page.keyboard.press('h');
  await expect(page.getByText('ngày hai: thêm test')).toHaveCount(0);
  await expect(dayButtons(page)).toHaveCount(0);
  await expect(page.getByText(/ · \d+ prompt/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Mở tất cả|Thu tất cả/ })).toHaveCount(0);
  await page.screenshot({ path: shotPath('S42', '8-hidden') });
  await page.keyboard.press('h');
  await expect(dayButtons(page)).toHaveCount(3);
  expect(await heads.evaluateAll(els => els.map(e => e.getAttribute('aria-expanded')))).toEqual(openBefore);
  expect(Math.abs((await timeline.evaluate(el => el.scrollTop)) - top)).toBeLessThan(2);

  // A single day: a plain label (no button, no chevron) and no open-all button.
  await page.getByRole('button', { name: 'Minh', exact: true }).click();
  await expect(timeline.getByText('Minh: một prompt')).toBeVisible();
  await expect(dayButtons(page)).toHaveCount(0);
  await expect(timeline.getByText(/ · Hôm nay$/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Mở tất cả|Thu tất cả/ })).toHaveCount(0);
  await page.screenshot({ path: shotPath('S42', '5-single-day') });

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
