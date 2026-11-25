import { type APIRequestContext, type Locator, type Page, expect, request, test } from '@playwright/test';
import type { TrainingEventsPage } from '../src/shared/api/index.js';
import { DESKTOP, mentorContext, shotPath } from './helpers';

// S43: a member with several Claude Code sessions open at once (PRODUCT.md §7.38): session blocks in each day, the "new" marks that go
// after 2 seconds in view, the number in the member list, "Đánh dấu đã đọc hết" with its undo, and the chip for prompts out of view.
// Hook payloads are sent for real; the server stamps `receivedAt`, so the older days (the midnight frame) are made by replacing the
// timestamps in the events answer the browser gets, as training-multi-day.spec.ts does.
const CWD = '/home/lan/bai-tap';
const common = (sid: string) => ({ session_id: sid, transcript_path: '/home/lan/.claude/projects/x/t.jsonl', cwd: CWD, permission_mode: 'default' });
const prompt = (text: string, sid: string) => ({ ...common(sid), hook_event_name: 'UserPromptSubmit', prompt: text });
const bash = (command: string, sid: string, ok = true) => ok
  ? { ...common(sid), hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command }, tool_response: { stdout: 'ok', stderr: '', interrupted: false }, duration_ms: 20 }
  : { ...common(sid), hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', tool_input: { command }, error: 'Command failed', duration_ms: 20 };
const edit = (file: string, from: string, to: string, sid: string) => ({ ...common(sid), hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: `${CWD}/${file}`, old_string: from, new_string: to }, tool_response: {}, duration_ms: 6 });
const clear = (sid: string) => ({ ...common(sid), hook_event_name: 'SessionEnd', reason: 'clear' });
const exit = (sid: string) => ({ ...common(sid), hook_event_name: 'SessionEnd', reason: 'prompt_input_exit' });

async function join(api: APIRequestContext, id: number, roomCode: string, name: string, ip: string) {
  const joined = await api.post(`/api/trainings/${id}/join`, { data: { displayName: name, roomCode, consent: true }, headers: { 'x-forwarded-for': ip } });
  expect(joined.ok()).toBeTruthy();
  const { token } = await joined.json() as { token: string };
  const cfg = await api.get('/api/training/me/hook-config', { headers: { 'x-training-member-token': token } });
  const { settings } = await cfg.json() as { settings: { hooks: { PostToolUse: { hooks: { headers: Record<string, string> }[] }[] } } };
  const ingest = settings.hooks.PostToolUse[0]!.hooks[0]!.headers['X-Training-Token']!;
  return async (...payloads: unknown[]) => { for (const p of payloads) expect((await api.post('/api/training/ingest', { data: p, headers: { 'X-Training-Token': ingest } })).status()).toBe(204); };
}

/** A moment `daysBack` days before today, at the given local time. */
const moment = (daysBack: number, h: number, m: number) => { const d = new Date(); d.setDate(d.getDate() - daysBack); d.setHours(h, m, 0, 0); return d.getTime(); };

const frame = (page: Page) => page.getByLabel(/^Các sự kiện, ngày mới nhất ở trên/);
const blockHeads = (page: Page) => frame(page).locator('button[id^="block-"][aria-expanded]');
/** The marks that are still on (one that is fading is going away). */
const badges = (page: Page) => frame(page).locator('[data-new-badge]:not([data-fading])');
const card = (page: Page, text: string): Locator => frame(page).locator('[data-turn-key]').filter({ hasText: text });
const box = async (l: Locator) => (await l.boundingBox())!;

async function newTraining(mentor: Awaited<ReturnType<typeof mentorContext>>, name: string) {
  const created = await mentor.context.request.post('/api/admin/trainings', { data: { name, allowAutoAccept: false } });
  expect(created.ok()).toBeTruthy();
  return await created.json() as { id: number; roomCode: string };
}

const memberIdOf = async (mentor: Awaited<ReturnType<typeof mentorContext>>, trainingId: number, name: string) => {
  const detail = await (await mentor.context.request.get(`/api/admin/trainings/${trainingId}`)).json() as { members: { id: number; displayName: string }[] };
  return detail.members.find(m => m.displayName === name)!.id;
};

/** The window focus the page sees is a switch the test controls, so "the window lost focus" can be tested without a second window. */
async function controlFocus(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __focused: boolean };
    w.__focused = true;
    document.hasFocus = () => w.__focused;
  });
  return async (focused: boolean) => {
    await page.evaluate(f => { (window as unknown as { __focused: boolean }).__focused = f; window.dispatchEvent(new Event(f ? 'focus' : 'blur')); }, focused);
  };
}

test('two sessions at once: blocks, new marks that fade after 2 seconds, the member list, mark all read with undo, the chip, F5', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const page = mentor.page;
  const setFocus = await controlFocus(page);
  const api = await request.newContext({ baseURL: baseURL! });
  const { id, roomCode } = await newTraining(mentor, 'Hai phiên cùng lúc');
  const sendLan = await join(api, id, roomCode, 'Lan', '10.43.0.1');
  const sendMai = await join(api, id, roomCode, 'Mai', '10.43.0.2');
  const A = 'cccc3333-0000-4000-8000-00000000000a';
  const B = 'cccc3333-0000-4000-8000-00000000000b';

  // A prompt, B prompt, A command, B command, A command; A is closed with /clear. 12 more prompts in B give the list something to scroll.
  await sendLan(prompt('A: viết hàm tính tổng giỏ hàng', A), prompt('B: sửa lỗi làm tròn', B), bash('npm test', A), bash('ls src', B), bash('npm run build', A), clear(A));
  for (let i = 1; i <= 12; i++) await sendLan(prompt(`B: bước ${i}`, B));
  await sendMai(prompt('Mai: một prompt', A));

  // First time on this browser: nothing stands out and the list shows no number (everything seen so far counts as read).
  await page.goto(`/admin/trainings/${id}`);
  await expect(page.getByRole('button', { name: 'Lan', exact: true })).toBeVisible();
  await expect(page.locator('[data-member-new]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Lan', exact: true }).click();
  await expect(frame(page).getByText('B: bước 12')).toBeVisible();
  await expect(badges(page)).toHaveCount(0);

  // Two blocks, oldest first, side by side in the same day: session 1 ended with /clear (folded), session 2 has no end signal (open).
  await expect(blockHeads(page)).toHaveCount(2);
  await expect(blockHeads(page).nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(blockHeads(page).nth(1)).toHaveAttribute('aria-expanded', 'true');
  await expect(blockHeads(page).nth(0)).toContainText('Phiên Claude Code 1');
  await expect(blockHeads(page).nth(0)).toContainText('1 prompt · 2 lệnh');
  await expect(blockHeads(page).nth(1)).toContainText('Phiên Claude Code 2');
  await expect(blockHeads(page).nth(1)).toContainText('13 prompt · 1 lệnh');
  await expect(frame(page).locator('[data-block-label="clear"]')).toHaveText('/clear');
  await expect(frame(page).locator('[data-block-label="open"]')).toHaveText('chưa kết thúc');
  await expect(frame(page).getByRole('button', { name: /Song song với phiên 2/ })).toBeVisible();
  await expect(frame(page).getByRole('button', { name: /Song song với phiên 1/ })).toBeVisible();
  await expect(blockHeads(page).nth(0)).toHaveAttribute('aria-controls', /^block-.*-body$/);
  await page.screenshot({ path: shotPath('S43', 'default-1440') });
  await page.setViewportSize({ width: 800, height: 900 });
  await page.screenshot({ path: shotPath('S43', 'default-800') });
  await page.setViewportSize(DESKTOP);

  // Each command is under the prompt of its own session; no turn "before the first prompt".
  await expect(frame(page).getByText('Trước prompt đầu tiên')).toHaveCount(0);
  await blockHeads(page).nth(0).click();
  await expect(blockHeads(page).nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(card(page, 'A: viết hàm tính tổng giỏ hàng')).toContainText('2 lệnh');
  await expect(card(page, 'B: sửa lỗi làm tròn')).toContainText('1 lệnh');
  await blockHeads(page).nth(0).press('Space');
  await expect(blockHeads(page).nth(0)).toHaveAttribute('aria-expanded', 'false');

  // "Song song với phiên 1" opens and goes to block 1.
  await frame(page).getByRole('button', { name: /Song song với phiên 1/ }).click();
  await expect(blockHeads(page).nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(blockHeads(page).nth(0)).toBeInViewport();

  // Mở tất cả / Thu tất cả cover days and blocks.
  await page.getByRole('button', { name: 'Thu tất cả' }).click();
  await expect(blockHeads(page).nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(blockHeads(page).nth(1)).toHaveAttribute('aria-expanded', 'false');
  await page.screenshot({ path: shotPath('S43', 'collapsed') });
  await page.getByRole('button', { name: 'Mở tất cả' }).click();
  await expect(blockHeads(page).nth(1)).toHaveAttribute('aria-expanded', 'true');
  await page.screenshot({ path: shotPath('S43', 'all') });

  // The mentor is on the list with nobody picked (the wide table): events arrive for Lan.
  await page.goto(`/admin/trainings/${id}`);
  await expect(page.getByRole('button', { name: 'Lan', exact: true })).toBeVisible();
  await sendLan(prompt('B: prompt mới nhất', B), prompt('A: viết test cho giỏ hàng', A), bash('npm test', A));
  // The list counts new prompts only, with the word "mới"; the command of an old prompt would not be counted.
  const lanRow = page.locator('tr', { has: page.getByRole('button', { name: 'Lan', exact: true }) });
  await expect(lanRow.locator('[data-member-new]')).toContainText('2 mới');
  await expect(page.getByRole('button', { name: 'Lan', exact: true })).toHaveAccessibleDescription('2 prompt có mục mới');
  // "N mới" sits at the right edge of the row, after the last column; the state of a learner is a line under the name.
  const table = await box(page.getByRole('table', { name: 'Học viên' }));
  const badgeBox = await box(lanRow.locator('[data-member-new]'));
  expect(table.x + table.width - (badgeBox.x + badgeBox.width)).toBeLessThan(24);
  await page.screenshot({ path: shotPath('S43', 'members') });
  await page.getByRole('button', { name: 'Mai', exact: true }).click(); // Lan is not in view
  await expect(frame(page).getByText('Mai: một prompt')).toBeVisible();

  // Block 1 (folded, ended with /clear) got a prompt: it stays folded and says how many prompts are new.
  await setFocus(false); // the window is not in front: nothing is read while the mentor "is away"
  await page.getByRole('button', { name: 'Lan', exact: true }).click();
  await expect(frame(page).getByText('B: prompt mới nhất')).toBeVisible();
  await expect(blockHeads(page).nth(0)).toHaveAttribute('aria-expanded', 'true'); // it holds something unread: open by default for a new reading
  await expect(badges(page).first()).toBeVisible();
  // The new prompt: "Mới" at the head of the row and a brand border; the old prompt with a new command: "· 1 mới" and a strip.
  const fresh = card(page, 'B: prompt mới nhất');
  await expect(fresh.locator('[data-new-badge="Mới"]')).toBeVisible();
  const withCommand = card(page, 'A: viết hàm tính tổng giỏ hàng');
  await expect(withCommand).toHaveCount(1);
  await expect(card(page, 'A: viết test cho giỏ hàng').locator('[data-new-badge="Mới"]')).toBeVisible();
  await fresh.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2600);
  await expect(fresh.locator('[data-new-badge="Mới"]')).toBeVisible(); // 2 seconds in view, but the window has no focus: still new
  await page.screenshot({ path: shotPath('S43', 'new-marks') });
  await fresh.screenshot({ path: shotPath('S43', 'card-new') });

  // The window is in front again: under 2 seconds the mark stays, after 2 seconds it goes (the list number follows).
  await setFocus(true);
  await page.waitForTimeout(900);
  await expect(fresh.locator('[data-new-badge="Mới"]')).toBeVisible();
  await expect(fresh.locator('[data-new-badge="Mới"]')).toHaveCount(0, { timeout: 5_000 });
  await expect(fresh).toHaveCSS('border-top-color', 'rgb(226, 230, 235)'); // back to ink-200
  await fresh.screenshot({ path: shotPath('S43', 'card-read') });
  // The other new prompts are read the same way once they are in the frame.
  await card(page, 'A: viết test cho giỏ hàng').scrollIntoViewIfNeeded();
  await expect(badges(page)).toHaveCount(0, { timeout: 8_000 });
  await expect(lanRow.locator('[data-member-new]')).toHaveCount(0);

  // F5 keeps what was read; an event that arrives after it is new again.
  await page.reload();
  await expect(frame(page).getByText('B: prompt mới nhất')).toBeVisible();
  await expect(badges(page)).toHaveCount(0);
  await expect(page.locator('[data-member-new]')).toHaveCount(0);

  // An event in an old prompt: it does not add to the list; the old prompt says "· 1 mới" and gets a strip "Lệnh mới".
  await setFocus(false);
  await sendLan(bash('npm run lint', A));
  // Block 1 is folded: the new command only moves the "1 mới" on its header, it does not open the block under the mentor's eyes.
  await expect(blockHeads(page).nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(frame(page).locator('[data-block-head]').nth(0).locator('[data-new-badge="count"]')).toContainText('1 mới');
  await page.screenshot({ path: shotPath('S43', 'collapsed-new') });
  await blockHeads(page).nth(0).click();
  const old = card(page, 'A: viết test cho giỏ hàng');
  await expect(old.locator('[data-new-events]')).toHaveText('1 mới');
  await expect(old.locator('[data-event-strip="command"]')).toContainText('npm run lint');
  await expect(old.locator('[data-new-badge="Lệnh mới"]')).toBeVisible();
  await expect(page.locator('[data-member-new]')).toHaveCount(0);
  await old.screenshot({ path: shotPath('S43', 'card-new-command') });

  // The chip: unread prompts out of the frame, on the edge of their side; a click goes to the nearest one.
  // the middle of the list: the newest prompt (session 1) and the last one of session 2 are both out of the frame
  await frame(page).evaluate(el => { el.scrollTop = el.scrollHeight / 2; });
  await page.waitForTimeout(300);
  await sendLan(prompt('B: ở cuối danh sách', B));
  const chip = page.locator('[data-unread-chip]');
  await expect(chip).toBeVisible();
  await expect(chip).toContainText('prompt có mục mới');
  await expect(chip).toHaveAttribute('data-side', 'below');
  await page.screenshot({ path: shotPath('S43', 'chip') });
  await chip.click();
  await expect(frame(page).locator('.pq-flash')).toBeInViewport();

  // "Đánh dấu đã đọc hết": the marks go at once, the button is disabled, the undo toast is there for 5 seconds and brings the marks back.
  const markAll = page.getByRole('button', { name: 'Đánh dấu đã đọc hết' });
  await expect(markAll).toBeEnabled();
  await markAll.click();
  await expect(badges(page)).toHaveCount(0);
  await expect(markAll).toBeDisabled();
  const toast = page.getByRole('status').filter({ hasText: 'Đã đánh dấu đọc hết' });
  await expect(toast).toBeVisible();
  await page.screenshot({ path: shotPath('S43', 'mark-all-read') });
  await toast.getByRole('button', { name: 'Hoàn tác' }).click();
  await expect(badges(page).first()).toBeVisible();
  await expect(markAll).toBeEnabled();
  await markAll.click();
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCount(0, { timeout: 7_000 }); // the chance to undo is over

  // Hide the content (H): no mark, no number in the list, and nothing is counted as read while it is hidden.
  await sendLan(prompt('A: sau khi đọc hết', A));
  await page.keyboard.press('h');
  await expect(page.getByText('Nội dung đang ẩn')).toBeVisible();
  await expect(badges(page)).toHaveCount(0);
  await expect(page.locator('[data-member-new]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Đánh dấu đã đọc hết' })).toHaveCount(0);
  await page.screenshot({ path: shotPath('S43', 'hidden') });
  await setFocus(true);
  await page.waitForTimeout(2600);
  await page.keyboard.press('h');
  await expect(card(page, 'A: sau khi đọc hết').locator('[data-new-badge="Mới"]')).toBeVisible(); // not read while it was hidden
});

test('the browser keeps nothing: the page still works, and an ended training clears the record', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const page = mentor.page;
  await page.addInitScript(() => {
    const blocked = () => { throw new DOMException('denied', 'SecurityError'); };
    Object.defineProperty(window, 'localStorage', { get: blocked });
  });
  const api = await request.newContext({ baseURL: baseURL! });
  const { id, roomCode } = await newTraining(mentor, 'Không có localStorage');
  const send = await join(api, id, roomCode, 'Lan', '10.43.0.3');
  await send(prompt('một prompt', 'dddd4444-0000-4000-8000-000000000001'));
  await page.goto(`/admin/trainings/${id}`);
  await page.getByRole('button', { name: 'Lan', exact: true }).click();
  await expect(frame(page).getByText('một prompt')).toBeVisible();
  await expect(badges(page)).toHaveCount(0); // as if it were the first time
  await send(prompt('prompt thứ hai', 'dddd4444-0000-4000-8000-000000000001'));
  await expect(card(page, 'prompt thứ hai').locator('[data-new-badge="Mới"]')).toBeVisible();

  // A second page with working storage: the record of the training goes when it ends.
  const ok = await mentorContext(browser, baseURL!, DESKTOP);
  await ok.page.goto(`/admin/trainings/${id}`);
  await ok.page.getByRole('button', { name: 'Lan', exact: true }).click();
  await expect(frame(ok.page).getByText('prompt thứ hai')).toBeVisible();
  await expect.poll(() => ok.page.evaluate(k => localStorage.getItem(k), `pq:mentor:training-read:${id}`)).not.toBeNull();
  await ok.context.request.post(`/api/admin/trainings/${id}/stop`);
  await ok.context.request.post(`/api/admin/trainings/${id}/end`);
  await expect(ok.page.getByText('Buổi này đã kết thúc')).toBeVisible({ timeout: 20_000 });
  expect(await ok.page.evaluate(k => localStorage.getItem(k), `pq:mentor:training-read:${id}`)).toBeNull();
});

test('a session across midnight, flags that open a folded block, and a day with a single session', async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const page = mentor.page;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const api = await request.newContext({ baseURL: baseURL! });
  const { id, roomCode } = await newTraining(mentor, 'Qua nửa đêm');
  const send = await join(api, id, roomCode, 'Minh', '10.43.0.4');
  const sendHoa = await join(api, id, roomCode, 'Hoa', '10.43.0.5');
  const P = 'eeee5555-0000-4000-8000-000000000005';
  const Q = 'eeee5555-0000-4000-8000-000000000006';
  // Yesterday: session 5 until 00:00 (a turn that crosses midnight), session 6 in parallel with three failures of the same command.
  // Today: session 5 goes on and exits. Session 6 is never closed.
  const plan: [unknown, number][] = [
    [prompt('08: lập kế hoạch', P), moment(1, 8, 40)], [bash('ls', P), moment(1, 8, 42)],
    [prompt('ngày trước: chạy test', Q), moment(1, 8, 50)], [edit('src/cart.test.ts', "it('tính tổng', () => {", "it.skip('tính tổng', () => {", Q), moment(1, 8, 50)], [bash('npm test', Q, false), moment(1, 8, 51)], [bash('npm test', Q, false), moment(1, 8, 52)], [bash('npm test', Q, false), moment(1, 8, 53)],
    ...[1, 2, 3, 4, 5, 6].map((i): [unknown, number] => [prompt(`10:${i}0: bước ${i}`, P), moment(1, 10, i * 10)]),
    [prompt('23:50: gom thay đổi để commit', P), moment(1, 23, 50)], [bash('git status', P), moment(0, 0, 3)],
    [prompt('sáng nay: tiếp tục', P), moment(0, 8, 10)], [exit(P), moment(0, 8, 30)],
  ];
  await send(...plan.map(([p]) => p));
  await sendHoa(prompt('Hoa: chỉ một phiên', 'ffff6666-0000-4000-8000-000000000001'));
  const minhId = await memberIdOf(mentor, id, 'Minh');
  const stamped = new Map<number, number>();
  await page.route(new RegExp(`/members/${minhId}/events`), async route => {
    const res = await route.fetch();
    const body = await res.json() as TrainingEventsPage;
    for (const e of body.events) {
      if (!stamped.has(e.id) && stamped.size < plan.length) stamped.set(e.id, plan[stamped.size]![1]);
      e.receivedAt = stamped.get(e.id) ?? e.receivedAt;
    }
    await route.fulfill({ response: res, json: body });
  });

  await page.goto(`/admin/trainings/${id}`);
  await page.getByRole('button', { name: 'Minh', exact: true }).click();
  await expect(frame(page).getByText('sáng nay: tiếp tục')).toBeVisible();
  await page.getByRole('button', { name: 'Mở tất cả' }).click();
  // Yesterday's block of session 5 ends "tiếp sang dd/mm", not "chưa kết thúc"; today's starts "tiếp từ dd/mm" and ends "thoát".
  const yesterday = frame(page).locator('[data-day-group]').nth(1);
  const today = frame(page).locator('[data-day-group]').nth(0);
  await expect(yesterday.locator('[data-block-label="next"]')).toHaveText(/^tiếp sang \d\d\/\d\d$/);
  await expect(today.locator('[data-block-label="from"]')).toHaveText(/^tiếp từ \d\d\/\d\d$/);
  await expect(today.locator('[data-block-label="exit"]')).toHaveText('thoát');
  await expect(yesterday.locator('[data-block-label="open"]')).toHaveText('chưa kết thúc'); // session 6
  await expect(yesterday.locator('button[id^="block-"]').first()).toContainText('08:40–00:03'); // the turn that crossed midnight stays with its prompt
  await expect(yesterday.getByText('23:50: gom thay đổi để commit')).toBeVisible();
  await page.screenshot({ path: shotPath('S43', 'midnight') });

  // The learner's state is a secondary line under the name; the row's buttons are in the design's order, and "Ẩn nội dung" is on the row.
  await expect(page.locator('[data-member-status]')).toContainText('có thể đang kẹt');
  const order = await page.getByLabel('Dòng thời gian của Minh').getByRole('button').evaluateAll(els => els.map(e => e.textContent ?? '').filter(t => /Đánh dấu đã đọc hết|tất cả|nội dung/.test(t)));
  expect(order.map(t => t.replace(/\s*H$/, ''))).toEqual(['Đánh dấu đã đọc hết', 'Thu tất cả', 'Ẩn nội dung']);

  // The pinned day header names the session whose own header has scrolled away.
  const key = (await yesterday.getAttribute('data-day-group'))!;
  await frame(page).evaluate((el, k) => {
    const g = el.querySelector(`[data-day-group="${k}"]`)!;
    const second = g.querySelectorAll('[data-block-head]')[1]!;
    el.scrollTop += second.getBoundingClientRect().top - el.getBoundingClientRect().top + 60;
  }, key);
  await expect(page.locator(`#day-${key}-row`)).toHaveAttribute('data-pinned', 'true');
  await expect(page.locator(`#day-${key}-row [data-pinned-block]`)).toHaveText(/^· Phiên \d$/);

  // The flag chip of the member goes to its evidence and opens the folded block that holds it.
  await frame(page).evaluate(el => { el.scrollTop = 0; });
  const failing = yesterday.locator('button[id^="block-"][aria-expanded]').filter({ hasText: 'ngày trước' });
  const q = yesterday.locator('[data-block-head]').nth(1).locator('button[aria-expanded]');
  await q.click();
  await expect(q).toHaveAttribute('aria-expanded', 'false');
  await expect(failing).toHaveCount(0);
  await page.getByRole('button', { name: /Đụng vào test/ }).first().click();
  await expect(q).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: shotPath('S43', 'flag') });
  await page.keyboard.press('Escape');

  // A day with a single session: a plain line, not a button.
  await page.getByRole('button', { name: 'Hoa', exact: true }).click();
  await expect(frame(page).getByText('Hoa: chỉ một phiên')).toBeVisible();
  await expect(blockHeads(page)).toHaveCount(0);
  await expect(frame(page).getByRole('group', { name: 'Phiên Claude Code 1' })).toBeVisible();
  await page.screenshot({ path: shotPath('S43', 'single') });

  // Keyboard: Tab goes block header, then the parallel button, then the prompts.
  await page.getByRole('button', { name: 'Minh', exact: true }).click();
  await expect(frame(page).getByText('sáng nay: tiếp tục')).toBeVisible();
  await page.getByRole('button', { name: 'Mở tất cả' }).click();
  const head = yesterday.locator('[data-block-head]').first();
  await head.locator('button[aria-expanded]').focus();
  await page.keyboard.press('Tab');
  await expect(head.locator('[data-parallel]')).toBeFocused();
  expect((await box(head.locator('button[aria-expanded]'))).height).toBeGreaterThanOrEqual(31);
});
