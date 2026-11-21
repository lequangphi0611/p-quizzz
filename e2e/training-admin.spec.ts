import { type APIRequestContext, type Page, expect, request, test } from '@playwright/test';
import { DESKTOP, mentorContext, shotPath } from './helpers';

// S35 — the mentor's side of an AI training (PRODUCT.md §7.34). Members join and send hook JSON through the real API, the
// way Claude Code would; the mentor works in the browser. Screenshots go to docs/design/S35-assets/.
const LAPTOP_1280 = { width: 1280, height: 800 };
const shot = async (p: Page, name: string, fullPage = false) => { await p.waitForTimeout(400); await p.screenshot({ path: shotPath('S35', name), fullPage }); };

const CWD = '/home/lan/bai-tap';
const common = (sid: string) => ({ session_id: sid, transcript_path: '/home/lan/.claude/projects/x/t.jsonl', cwd: CWD, permission_mode: 'default' });
// A command far wider than the timeline column: it must stay on ONE line, end with "…", and show in full on hover (the title).
const LONG_COMMAND = `find src -type f -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" -newer package.json -exec grep -l "describe(" {} + | sort | uniq -c | sort -rn | head -n 50 | tee /tmp/${'long-'.repeat(8)}result.txt`;

const hook = {
  prompt: (text: string, sid: string) => ({ ...common(sid), hook_event_name: 'UserPromptSubmit', prompt: text }),
  bash: (command: string, stdout: string, ms: number, sid: string) => ({ ...common(sid), hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command }, tool_response: { stdout, stderr: '', interrupted: false }, duration_ms: ms }),
  bashFail: (command: string, error: string, ms: number, sid: string) => ({ ...common(sid), hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', tool_input: { command }, error, duration_ms: ms }),
  read: (file: string, sid: string) => ({ ...common(sid), hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: `${CWD}/${file}` }, tool_response: { type: 'text', file: { filePath: `${CWD}/${file}`, content: 'export const total = 1;', numLines: 1, startLine: 1, totalLines: 1 } }, duration_ms: 12 }),
  write: (file: string, content: string, sid: string) => ({ ...common(sid), hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: `${CWD}/${file}`, content }, tool_response: { type: 'create', filePath: `${CWD}/${file}` }, duration_ms: 8 }),
  powershell: (command: string, ms: number, sid: string) => ({ ...common(sid), hook_event_name: 'PostToolUse', tool_name: 'PowerShell', tool_input: { command }, tool_response: { stdout: '', stderr: '' }, duration_ms: ms }),
  edit: (file: string, from: string, to: string, sid: string) => ({ ...common(sid), hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: `${CWD}/${file}`, old_string: from, new_string: to }, tool_response: { filePath: `${CWD}/${file}` }, duration_ms: 6 }),
};

interface Joined { name: string; token: string; send: (payload: unknown) => Promise<{ status: number; body: string }>; api: APIRequestContext }

/** A member's browser and machine in one: joins with consent, then sends hook JSON with its own ingest token. */
async function joinMember(api: APIRequestContext, trainingId: number, roomCode: string, name: string, ip: string): Promise<Joined> {
  const joined = await api.post(`/api/trainings/${trainingId}/join`, { data: { displayName: name, roomCode, consent: true }, headers: { 'x-forwarded-for': ip } });
  expect(joined.ok(), `join ${name}`).toBeTruthy();
  const { token } = await joined.json() as { token: string };
  const cfg = await api.get('/api/training/me/hook-config', { headers: { 'x-training-member-token': token } });
  expect(cfg.ok(), 'hook config').toBeTruthy();
  const { settings } = await cfg.json() as { settings: { hooks: { PostToolUse: { hooks: { headers: Record<string, string> }[] }[] } } };
  const ingestToken = settings.hooks.PostToolUse[0]!.hooks[0]!.headers['X-Training-Token']!;
  return {
    name, token, api,
    send: async payload => {
      const r = await api.post('/api/training/ingest', { data: payload, headers: { 'X-Training-Token': ingestToken } });
      return { status: r.status(), body: await r.text() };
    },
  };
}

const TIMELINE = 'Các sự kiện, cũ ở trên, mới ở dưới';
const long = Array.from({ length: 1240 }, (_, i) => `build ${String(i + 1).padStart(4, '0')}: compiled module-${i % 37}.ts in ${(i * 7) % 90} ms`).join('\n');
const testFile = Array.from({ length: 38 }, (_, i) => (i === 0 ? "import { total } from './cart';" : i === 1 ? "test('tính tổng khi có mã giảm giá', () => {" : i === 37 ? '});' : `  expect(total(cart${i}, 'GIAM10')).toBe(${90 + (i % 3)});`)).join('\n');
const FAIL = 'FAIL src/cart.test.ts › tính tổng khi có mã giảm giá\n  Expected: 90\n  Received: 100';

test('mentor runs an AI training: room code, members, timeline, output, stop, end', async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const page = mentor.page;
  const members = await request.newContext({ baseURL: baseURL! });
  const detailRequests: string[] = [];
  page.on('request', r => { if (r.url().includes('/detail')) detailRequests.push(r.url()); });

  // ── List and create ──────────────────────────────────────────────────────────────────────────────────
  await page.goto('/admin/trainings');
  await expect(page.getByRole('heading', { name: 'Buổi training AI', level: 1 })).toBeVisible();
  await expect(page.getByText('Chưa có buổi training nào')).toBeVisible();
  await shot(page, 'M10b-list-empty');

  await page.getByRole('button', { name: 'Tạo buổi' }).click();
  await expect(page.getByText('Nhập tên buổi training')).toBeVisible(); // no name, nothing sent
  await page.getByLabel('Tên buổi').fill('Claude Code buổi 2: viết test');
  await page.getByRole('button', { name: 'Tạo buổi' }).click();
  await expect(page).toHaveURL(/\/admin\/trainings\/\d+$/);
  const trainingId = Number(page.url().match(/trainings\/(\d+)/)![1]);

  // ── Open, nobody yet: the code is large, with the link ──────────────────────────────────────────────
  await expect(page.getByRole('heading', { name: 'Claude Code buổi 2: viết test', level: 1 })).toBeVisible();
  const codeLabel = await page.getByLabel(/^Mã phòng \d/).getAttribute('aria-label');
  const roomCode = codeLabel!.replace(/\D/g, '');
  expect(roomCode).toMatch(/^\d{6}$/);
  await expect(page.getByText(`/?room=${roomCode}`)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Đọc cho lớp' })).toBeVisible();
  await shot(page, 'M11-room-code');

  // ── A member joins: shown within 3 seconds, no reload ──────────────────────────────────────────────
  const t0 = Date.now();
  const binh = await joinMember(members, trainingId, roomCode, 'Bình', '10.35.0.1');
  await expect(page.getByRole('button', { name: 'Bình', exact: true })).toBeVisible({ timeout: 3_000 });
  expect(Date.now() - t0).toBeLessThan(3_500);
  await expect(page.getByLabel(/^Mã phòng \d/)).toHaveCount(0); // the big card is gone; the code stays small in the header
  await expect(page.getByText('Chưa nhận tín hiệu').first()).toBeVisible(); // joined, nothing sent yet

  const an = await joinMember(members, trainingId, roomCode, 'An', '10.35.0.2');
  const chi = await joinMember(members, trainingId, roomCode, 'Chi', '10.35.0.3');
  const dung = await joinMember(members, trainingId, roomCode, 'Dũng', '10.35.0.4');
  await expect(page.getByRole('button', { name: 'Dũng', exact: true })).toBeVisible({ timeout: 3_000 });

  // ── Hooks arrive ──────────────────────────────────────────────────────────────────────────────────────
  const s1 = 'aaaa1111-0000-4000-8000-000000000001';
  const s2 = 'aaaa1111-0000-4000-8000-000000000002';
  expect((await binh.send(hook.prompt('viết test cho hàm tính tổng giỏ hàng, chạy test luôn', s1))).status).toBe(204);
  await expect(page.locator('tr', { hasText: 'Bình' }).getByText('Đã nhận tín hiệu')).toBeVisible({ timeout: 3_000 });
  await binh.send(hook.read('src/cart.ts', s1));
  await binh.send(hook.powershell('Get-ChildItem -Recurse src', 412, s1));
  await binh.send(hook.bash(LONG_COMMAND, '', 130, s1));
  await binh.send(hook.write('src/cart.test.ts', testFile, s1));
  await binh.send(hook.bash('cat build.log', long, 65_000, s1));
  await binh.send(hook.edit('src/cart.test.ts', 'toBe(90)', 'toBe(100)', s1));
  await binh.send(hook.bashFail('npm test', FAIL, 3400, s1));
  await binh.send(hook.prompt('sửa đi', s1));
  await binh.send(hook.bashFail('npm test', FAIL, 3100, s1));
  await binh.send(hook.bashFail('npm test', FAIL, 3300, s1));
  await an.send(hook.prompt('giải thích hàm total', s1));
  await an.send(hook.bash('git status', 'On branch main\nnothing to commit, working tree clean', 48, s1));
  await dung.send(hook.prompt('tạo file README', s1));

  // The members table: sorted by name, stuck flag on Bình, no score or rank anywhere.
  const rows = page.locator('table[aria-label="Học viên"] tbody tr');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText('An');
  await expect(rows.nth(1)).toContainText('Bình');
  await expect(rows.nth(1)).toContainText('Có thể đang kẹt', { timeout: 6_000 });
  await expect(rows.nth(2)).toContainText('Chi');
  await expect(rows.nth(2)).toContainText('Chưa nhận tín hiệu');
  await expect(page.getByRole('columnheader', { name: /điểm|hạng/i })).toHaveCount(0);
  await shot(page, 'M12-co-hoc-vien');

  // ── The timeline of Bình ──────────────────────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Bình', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`hv=\\d+`));
  const timeline = page.getByLabel(TIMELINE);
  await expect(page.getByRole('heading', { name: 'Bình', level: 2 })).toBeVisible();
  await expect(timeline.getByText('viết test cho hàm tính tổng giỏ hàng, chạy test luôn')).toBeVisible();
  await expect(timeline.getByText('sửa đi')).toBeVisible();
  await expect(timeline.getByText('Có thể đang kẹt · cùng lệnh lỗi 3 lần liên tiếp')).toBeVisible();
  await expect(timeline.getByText('1 phút 05 s')).toBeVisible();
  await expect(timeline.getByText('3,4 s')).toBeVisible();
  await expect(timeline.getByText('Expected: 90').first()).toBeVisible(); // the summary line of a failed command
  expect(detailRequests).toHaveLength(0); // no output loaded until a button is pressed

  // PowerShell is shown as "PS" (hover and screen readers still get the full name); a long command stays on one line with "…" and its whole text on hover.
  const psRow = timeline.locator('li', { hasText: 'Get-ChildItem -Recurse src' });
  await expect(psRow.locator('abbr')).toHaveText('PS');
  await expect(psRow.locator('abbr')).toHaveAttribute('title', 'PowerShell');
  const longTarget = timeline.locator('li', { hasText: 'find src -type f' }).locator('span[title]').filter({ hasText: 'find src -type f' });
  await expect(longTarget).toHaveAttribute('title', LONG_COMMAND);
  const fit = await longTarget.evaluate(el => ({ cut: el.scrollWidth > el.clientWidth, oneLine: el.getBoundingClientRect().height < 24, overflow: getComputedStyle(el).textOverflow, wrap: getComputedStyle(el).whiteSpace }));
  expect(fit).toEqual({ cut: true, oneLine: true, overflow: 'ellipsis', wrap: 'nowrap' });
  const left = async (loc: typeof psRow) => (await loc.locator('span[title]').first().boundingBox())!.x;
  expect(Math.abs((await left(psRow)) - (await left(timeline.locator('li', { hasText: 'find src -type f' }))))).toBeLessThan(1); // commands line up whatever the tool's name
  await expect(timeline.getByRole('button', { name: /xem đầy đủ/i })).toHaveCount(0); // no click-to-expand any more
  await shot(page, 'M13-dong-thoi-gian');

  // F5 keeps the choice
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bình', level: 2 })).toBeVisible();
  await expect(page.getByLabel(TIMELINE).getByText('sửa đi')).toBeVisible();

  // ── Output: right-hand panel, head, "đã lược bỏ", tail ───────────────────────────────────────────────
  const catRow = page.locator('li', { hasText: 'cat build.log' });
  const trigger = catRow.getByRole('button', { name: 'Xem output' });
  await trigger.click();
  const panel = page.getByRole('complementary', { name: /Output/ });
  await expect(panel.getByText('… đã lược bỏ 840 dòng …')).toBeVisible();
  await expect(panel.getByText('build 0001: compiled')).toBeVisible();
  await expect(panel.getByText('build 1240: compiled')).toBeVisible();
  expect(detailRequests).toHaveLength(1);
  await shot(page, 'M14-output');

  await page.setViewportSize(LAPTOP_1280);
  await shot(page, 'M12c-1280');
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });

  // J / K step to the previous / next command with something to open; Esc closes and returns the focus
  await page.keyboard.press('j'); // the Edit after "cat build.log": its change, as - / + lines
  await expect(page.getByRole('complementary', { name: /Thay đổi/ }).getByText('+ toBe(100)')).toBeVisible();
  await shot(page, 'M14b-thay-doi');
  await page.keyboard.press('k');
  await expect(page.getByRole('complementary', { name: /Output/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // ── Hide the content (H): nothing readable on a projector; remembered after a reload ────────────────
  await page.keyboard.press('h');
  await expect(page.getByText('Nội dung đang ẩn')).toBeVisible();
  await expect(page.getByText('viết test cho hàm tính tổng giỏ hàng, chạy test luôn')).toHaveCount(0);
  await shot(page, 'M12b-an-noi-dung');
  await page.reload();
  await expect(page.getByText('Nội dung đang ẩn')).toBeVisible();
  await page.getByRole('button', { name: /Hiện nội dung/ }).click();
  await expect(page.getByLabel(TIMELINE).getByText('sửa đi')).toBeVisible();

  // ── Live: a new line follows the end; higher up it only counts ─────────────────────────────────────
  for (let i = 0; i < 25; i++) await binh.send(hook.bash(`echo ${i}`, `${i}`, 5, s2));
  await expect(timeline.getByText('echo 24', { exact: true })).toBeVisible({ timeout: 6_000 });
  await expect(page.getByText(/sự kiện mới/)).toHaveCount(0); // at the end: it followed, no chip
  await timeline.evaluate(el => { el.scrollTop = 0; });
  await page.waitForTimeout(200);
  await binh.send(hook.bash('echo late-1', 'late-1', 5, s2));
  await binh.send(hook.bash('echo late-2', 'late-2', 5, s2));
  await expect(page.getByRole('button', { name: '2 sự kiện mới' })).toBeVisible({ timeout: 8_000 });
  expect(await timeline.evaluate(el => el.scrollTop)).toBeLessThan(5); // did not jump
  await shot(page, 'M13b-su-kien-moi');
  await page.getByRole('button', { name: '2 sự kiện mới' }).click();
  await expect(timeline.getByText('echo late-2', { exact: true })).toBeInViewport();
  await expect(page.getByText(/sự kiện mới/)).toHaveCount(0);

  // ── Invite one out (Mời ra), with a confirmation ─────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Dũng', exact: true }).click();
  await page.getByRole('button', { name: 'Mời ra' }).click();
  const removeDialog = page.getByRole('dialog');
  await expect(removeDialog.getByText('Mời Dũng ra khỏi buổi?')).toBeVisible();
  await shot(page, 'M19-moi-ra');
  await removeDialog.getByRole('button', { name: 'Mời ra và xoá' }).click();
  await expect(page.getByRole('button', { name: 'Dũng', exact: true })).toHaveCount(0, { timeout: 5_000 });
  await expect(page).not.toHaveURL(/hv=/); // the removed member's choice left the address too

  // ── Stop recording ───────────────────────────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: /Dừng thu/ }).click();
  const stopDialog = page.getByRole('dialog');
  await expect(stopDialog.getByText('Không mở thu lại được')).toBeVisible();
  await shot(page, 'M15-xac-nhan-dung');
  await stopDialog.getByRole('button', { name: 'Dừng thu' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Đã dừng thu' })).toBeVisible();
  await expect(page.getByLabel(/^Mã phòng \d/)).toHaveCount(0);
  await expect(page.getByText('Đã gỡ 0/3')).toBeVisible();
  await expect(page.getByRole('button', { name: /Kết thúc/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Dừng thu/ })).toHaveCount(0);

  // An removes the hook and passes the check; Bình still sends (the server answers with a reminder)
  expect((await an.api.post('/api/training/me/uninstall-check', { headers: { 'x-training-member-token': an.token } })).status()).toBe(204);
  const stillSending = await binh.send(hook.prompt('còn gửi sau khi dừng', s2));
  expect(stillSending.status).toBe(200);
  expect(stillSending.body).toContain('systemMessage');
  await page.waitForTimeout(5_200);
  const finished = await an.api.post('/api/training/me/uninstall-check/finish', { headers: { 'x-training-member-token': an.token } });
  expect(await finished.json()).toEqual({ result: 'passed' });
  await expect(page.getByText('Đã gỡ 1/3')).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText('Còn 1 máy vẫn gửi')).toBeVisible();
  await expect(page.locator('tr', { hasText: 'Bình' }).getByText('Vẫn gửi sau khi dừng')).toBeVisible();
  await expect(page.locator('tr', { hasText: 'An' }).getByText('Đã gỡ', { exact: true })).toBeVisible();
  // the collected data can still be read after the stop
  await page.getByRole('button', { name: 'Bình', exact: true }).click();
  await expect(page.getByLabel(TIMELINE).getByText('sửa đi')).toBeVisible();
  await shot(page, 'M16-da-dung');

  // ── End: everything is deleted, only name, time and count remain ─────────────────────────────────────
  await page.getByRole('button', { name: /Kết thúc/ }).click();
  const endDialog = page.getByRole('dialog');
  await expect(endDialog.getByText('xoá vĩnh viễn')).toBeVisible();
  await shot(page, 'M17-xac-nhan-ket-thuc');
  await endDialog.getByRole('button', { name: 'Kết thúc và xoá' }).click();
  await expect(page.getByText('Buổi này đã kết thúc')).toBeVisible();
  await expect(page.locator('dt', { hasText: 'Số người' }).locator('+ dd')).toHaveText('3');
  await expect(page.getByRole('button', { name: 'Bình', exact: true })).toHaveCount(0);
  await expect(page.getByText('Toàn bộ prompt, lệnh và output đã bị xoá vĩnh viễn')).toBeVisible();
  await shot(page, 'M18-da-ket-thuc');

  // the list now shows it as ended
  await page.goto('/admin/trainings');
  await expect(page.getByRole('row', { name: /Claude Code buổi 2/ }).getByText('Đã kết thúc')).toBeVisible();
  await expect(page.getByRole('row', { name: /Claude Code buổi 2/ }).getByText('3 người')).toBeVisible();
  await shot(page, 'M10-danh-sach');

  // a removed member's data is gone for good: its token no longer reads anything
  expect((await chi.api.get('/api/training/me', { headers: { 'x-training-member-token': chi.token } })).status()).toBe(401);
  await members.dispose();
});
