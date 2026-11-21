import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { PHONE, importExam, makeSession, memberContext, mentorContext, shotPath } from './helpers';

// S36 — an AI training from the member's side: code on the first page → consent → install → "Đã nhận tín hiệu" →
// mentor stops → removal → removal check → ended. The mentor acts through the API; hook events are posted by hand,
// shaped like Claude Code's (src/server/domain/training/fixtures/hook-payloads.ts).

const SECRET_PROMPT = 'viết test cho hàm giỏ hàng, mã bí mật PROMPT-XYZ-123';
const SECRET_COMMAND = 'npm test -- --only COMMAND-XYZ-456';
const SECRET_OUTPUT = 'FAIL OUTPUT-XYZ-789 expected 90 received 100';
const SECRETS = [SECRET_PROMPT, SECRET_COMMAND, SECRET_OUTPUT, 'PROMPT-XYZ-123', 'COMMAND-XYZ-456', 'OUTPUT-XYZ-789'];
const CWD = '/home/lan/bai-tap-training';

const hookBase = { session_id: 'c0ffee00-1111-4222-8333-444455556666', transcript_path: `${CWD}/t.jsonl`, cwd: CWD, permission_mode: 'default' };
const promptEvent = { ...hookBase, hook_event_name: 'UserPromptSubmit', prompt: SECRET_PROMPT };
const bashEvent = { ...hookBase, hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', tool_input: { command: SECRET_COMMAND }, error: SECRET_OUTPUT, duration_ms: 3400 };

interface Training { id: number; roomCode: string }

async function createTraining(api: APIRequestContext, name: string): Promise<Training> {
  const res = await api.post('/api/admin/trainings', { data: { name } });
  expect(res.ok(), 'create training').toBeTruthy();
  return (await res.json()) as Training;
}

async function finishTraining(api: APIRequestContext, id: number) {
  for (const step of ['stop', 'end']) await api.post(`/api/admin/trainings/${id}/${step}`); // the server is shared by every spec of a run: leave nothing open
}

const memberToken = (page: Page, id: number) => page.evaluate(i => localStorage.getItem(`pq:training:${i}`), id);

async function hookConfigOf(request: APIRequestContext, token: string) {
  const res = await request.get('/api/training/me/hook-config', { headers: { 'x-training-member-token': token } });
  expect(res.ok(), 'hook-config').toBeTruthy();
  const cfg = (await res.json()) as { settings: { hooks: { PostToolUse: { hooks: { headers: Record<string, string> }[] }[] } }; mergePrompt: string };
  return { ingestToken: cfg.settings.hooks.PostToolUse[0]!.hooks[0]!.headers['X-Training-Token']!, mergePrompt: cfg.mergePrompt };
}

const ingest = (request: APIRequestContext, ingestToken: string, data: unknown) => request.post('/api/training/ingest', { headers: { 'X-Training-Token': ingestToken }, data });

/** Types the code on the first page the way a member does; the page moves on to the training by itself. */
async function enterCode(page: Page, t: Training) {
  await page.goto('/');
  await page.getByLabel('Mã phòng').fill(t.roomCode);
  await expect(page).toHaveURL(new RegExp(`/training/${t.id}`));
}

/** Consent, then the install screen. */
async function joinAs(page: Page, t: Training, name: string) {
  await enterCode(page, t);
  await page.getByLabel('Tên của bạn').fill(name);
  await page.getByLabel('Tôi đã đọc và đồng ý').check();
  await page.getByRole('button', { name: 'Đồng ý và tiếp tục' }).click();
  await expect(page.getByRole('heading', { name: 'Làm 3 bước trên laptop có Claude Code' })).toBeVisible();
}

/** The page shows neither what was sent nor anything of the collected events (the member API never returns them). */
async function expectNoCollectedContent(page: Page) {
  const html = await page.content();
  const text = await page.locator('body').innerText();
  for (const s of SECRETS) { expect(html, s).not.toContain(s); expect(text, s).not.toContain(s); }
}

const sameWidthAndRow = async (a: ReturnType<Page['locator']>, b: ReturnType<Page['locator']>) => {
  const [x, y] = [await a.boundingBox(), await b.boundingBox()];
  expect(x && y).toBeTruthy();
  expect(Math.abs(x!.width - y!.width)).toBeLessThan(1.5);
  expect(Math.abs(x!.height - y!.height)).toBeLessThan(1.5);
  expect(Math.abs(x!.y - y!.y)).toBeLessThan(1.5);
};

/** Long screens scroll inside the page frame: a tall window lets the whole screen's content be captured; the usual 1440×900 is restored afterwards. */
async function tallShot(page: Page, path: string) {
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.width, height: 2200 });
  await page.locator('[data-pq-focus]').screenshot({ path });
  await page.setViewportSize(size);
}

async function phoneView(context: BrowserContext, path: string) {
  const phone = await context.newPage(); // same browser profile, so the same token
  await phone.setViewportSize(PHONE);
  await phone.goto(path);
  return phone;
}

test('the whole member flow: code → consent → install → recording → stopped → removal check → ended', async ({ browser, baseURL, request }) => {
  const mentor = await mentorContext(browser, baseURL!);
  const training = await createTraining(mentor.context.request, 'Claude Code buổi 2: viết test');
  const an = await memberContext(browser, baseURL!);
  await an.context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = an.page;

  // ── 1 · Consent ──────────────────────────────────────────────────────────────────────────────────
  await enterCode(page, training);
  await expect(page.getByRole('heading', { name: 'Claude Code buổi 2: viết test' })).toBeVisible();
  for (const must of ['Những gì được gửi về máy mentor', 'Những gì không gửi', 'Có thể chứa bí mật', 'mật khẩu hoặc mã bí mật', 'Chỉ mentor xem', 'Kết thúc', 'Rút lại đồng ý bất cứ lúc nào']) {
    await expect(page.getByText(must).first()).toBeVisible();
  }
  await expect(page.getByText('chỉ gửi tên file và số dòng')).toBeVisible(); // Read: file name and line count only
  await expect(page.getByText('vẫn được gửi, kèm output')).toBeVisible(); // the honest caveat about commands that touch other places
  const agree = page.getByRole('button', { name: 'Đồng ý và tiếp tục' });
  const decline = page.getByRole('button', { name: 'Không tham gia' });
  await expect(agree).toBeDisabled();
  await expect(decline).toBeEnabled();
  await page.getByLabel('Tên của bạn').fill('An');
  await expect(agree).toBeDisabled(); // a name alone is not consent
  await sameWidthAndRow(agree, decline);
  await tallShot(page, shotPath('S36', '1-consent-desktop'));
  await page.getByLabel('Tôi đã đọc và đồng ý').check();
  await expect(agree).toBeEnabled();
  await page.getByLabel('Tôi đã đọc và đồng ý').uncheck();
  await expect(agree).toBeDisabled();

  // phone: the same screen
  const phoneConsent = await memberContext(browser, baseURL!, PHONE);
  await enterCode(phoneConsent.page, training);
  await phoneConsent.page.screenshot({ path: shotPath('S36', '1-consent-phone'), fullPage: true });
  await sameWidthAndRow(phoneConsent.page.getByRole('button', { name: 'Đồng ý và tiếp tục' }), phoneConsent.page.getByRole('button', { name: 'Không tham gia' }));
  const phoneBtn = await phoneConsent.page.getByRole('button', { name: 'Không tham gia' }).boundingBox();
  expect(phoneBtn!.height).toBeGreaterThanOrEqual(48);
  await phoneConsent.context.close();

  // ── join ─────────────────────────────────────────────────────────────────────────────────────────
  await page.getByLabel('Tôi đã đọc và đồng ý').check();
  await page.getByRole('button', { name: 'Đồng ý và tiếp tục' }).click();
  await expect(page.getByRole('heading', { name: 'Làm 3 bước trên laptop có Claude Code' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/training/${training.id}$`)); // the code is gone from the address
  const token = (await memberToken(page, training.id))!;
  expect(token).toBeTruthy();

  // ── 2-4 · Install: the member's own config, copy buttons, waiting ──────────────────────────────────
  const cfg = await hookConfigOf(request, token);
  const ask = page.getByLabel('Câu nhờ Claude Code ghép cấu hình');
  await expect(ask).toContainText(cfg.ingestToken);
  await expect(ask).toContainText('settings.local.json');
  await expect(page.getByText('Ghép vào, đừng ghi đè')).toBeVisible();
  await expect(page.getByText('~/.claude/settings.json').first()).toBeVisible();
  await expect(page.getByText('Hộp thoại tin cậy thư mục')).toBeVisible();
  await expect(page.getByText('Đang chờ tín hiệu từ Claude Code của bạn…')).toBeVisible();
  await page.getByRole('button', { name: 'Sao chép' }).nth(1).click(); // 0 = folder commands, 1 = the merge request
  await expect(page.getByRole('button', { name: 'Đã sao chép' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(cfg.mergePrompt);
  await tallShot(page, shotPath('S36', '3a-install-ask-desktop'));

  await page.getByRole('radio', { name: /B\. Tự ghép/ }).click();
  const manual = page.getByLabel(/Đoạn cấu hình để ghép vào/);
  await expect(manual).toContainText(cfg.ingestToken);
  await expect(manual).toContainText('PostToolUseFailure');
  await expect(manual).toContainText('"timeout": 1');
  await expect(page.getByText('Chỉ file trong thư mục bài tập')).toBeVisible();
  await tallShot(page, shotPath('S36', '3b-install-manual-desktop'));
  await page.getByRole('radio', { name: /A\. Nhờ Claude Code/ }).click();
  await expectNoCollectedContent(page);

  // ── 5 · The first signal → "Đã nhận tín hiệu" within 3 seconds (polled every 3 s) ─────────────────
  expect((await ingest(request, cfg.ingestToken, promptEvent)).status()).toBe(204);
  expect((await ingest(request, cfg.ingestToken, bashEvent)).status()).toBe(204);
  const sent = Date.now();
  await expect(page.getByRole('heading', { name: 'Đã nhận tín hiệu' })).toBeVisible({ timeout: 4000 });
  expect(Date.now() - sent).toBeLessThan(3600);
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: 'Đã nhận tín hiệu' })).toHaveCount(1);
  await expectNoCollectedContent(page);
  await page.screenshot({ path: shotPath('S36', '5-recording-desktop') });
  const phoneRecording = await phoneView(an.context, `/training/${training.id}`);
  await expect(phoneRecording.getByRole('heading', { name: 'Đã nhận tín hiệu' })).toBeVisible();
  await phoneRecording.screenshot({ path: shotPath('S36', '5-recording-phone'), fullPage: true });
  const phoneWithdraw = await phoneRecording.getByRole('button', { name: 'Rút lại đồng ý' }).boundingBox();
  expect(phoneWithdraw!.height).toBeGreaterThanOrEqual(48);

  // ── 6 · Withdraw dialog (cancelled) ───────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Rút lại đồng ý' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('xoá ngay');
  await expect(dialog).toContainText('gỡ cấu hình');
  await page.waitForTimeout(500); // let the dialog's pop-in animation finish
  await page.screenshot({ path: shotPath('S36', '6-withdraw-dialog-desktop') });
  await dialog.getByRole('button', { name: 'Giữ lại' }).click();
  await expect(dialog).toBeHidden();
  expect(await memberToken(page, training.id)).toBe(token); // nothing was withdrawn

  // ── 7 · The mentor stops: the page moves to removal by itself (slow poll while recording, ≤ 10 s) ───
  const stop = await mentor.context.request.post(`/api/admin/trainings/${training.id}/stop`);
  expect(stop.ok(), 'stop').toBeTruthy();
  await expect(page.getByRole('alert').filter({ hasText: 'Mentor đã dừng thu' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Gỡ cấu hình khỏi thư mục bài tập' })).toBeVisible();
  await expect(page.getByLabel('Câu nhờ Claude Code gỡ cấu hình')).toContainText(`http://${new URL(baseURL!).host}/api/training/ingest`);
  await expect(page.getByLabel('Câu nhờ Claude Code gỡ cấu hình')).not.toContainText(cfg.ingestToken); // the removal request carries no token
  await tallShot(page, shotPath('S36', '7-remove-desktop'));
  await page.getByRole('radio', { name: /B\. Tự xoá/ }).click();
  await expect(page.getByText('Chỉ xoá đúng đoạn đã thêm')).toBeVisible();
  await page.getByRole('radio', { name: /A\. Nhờ Claude Code gỡ/ }).click();
  const phoneRemove = await phoneView(an.context, `/training/${training.id}`);
  await expect(phoneRemove.getByText('Mentor đã dừng thu')).toBeVisible();
  await phoneRemove.screenshot({ path: shotPath('S36', '7-remove-phone'), fullPage: true });
  await phoneRemove.close();
  await expectNoCollectedContent(page);

  // ── 8 · Removal check: nothing is sent → "Đã gỡ" (after the 5-second lock on "Xong") ────────────────
  await page.getByRole('button', { name: 'Kiểm tra đã gỡ' }).click();
  await expect(page.getByRole('heading', { name: 'Kiểm tra đã gỡ' })).toBeVisible();
  const locked = page.getByRole('button', { name: /^Xong \(còn \d giây\)$/ });
  await expect(locked).toBeDisabled();
  await page.screenshot({ path: shotPath('S36', '8-check-locked-desktop') });
  const done = page.getByRole('button', { name: 'Xong', exact: true });
  await expect(done).toBeEnabled({ timeout: 8000 });
  await done.click();
  await expect(page.getByRole('heading', { name: 'Đã gỡ' })).toBeVisible();
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: 'đã gỡ' })).toHaveCount(1);
  await page.screenshot({ path: shotPath('S36', '8b-removed-desktop') });
  const mine = await (await mentor.context.request.get(`/api/admin/trainings/${training.id}`)).json() as { uninstalled: { count: number; total: number } };
  expect(mine.uninstalled).toEqual({ count: 1, total: 1 });

  // ── 9 · Ended: the mentor deletes everything; the member's token no longer works ──────────────────
  expect((await mentor.context.request.post(`/api/admin/trainings/${training.id}/end`)).ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Buổi training đã kết thúc' })).toBeVisible();
  expect(await memberToken(page, training.id)).toBeNull();
  await page.screenshot({ path: shotPath('S36', '9-ended-desktop') });
  // the phone still holds the (now unknown) token, as a second device would
  const phoneEnded = await phoneView(an.context, '/');
  await phoneEnded.evaluate(([i, t]) => localStorage.setItem(`pq:training:${i}`, t!), [String(training.id), token]);
  await phoneEnded.goto(`/training/${training.id}`);
  await expect(phoneEnded.getByRole('heading', { name: 'Buổi training đã kết thúc' })).toBeVisible();
  await phoneEnded.screenshot({ path: shotPath('S36', '9-ended-phone'), fullPage: true });
  await page.getByRole('button', { name: 'Về trang đầu' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('Mã phòng')).toBeVisible();
});

test('a removal check that still receives a signal fails, with /hooks guidance, and can be run again', async ({ browser, baseURL, request }) => {
  const mentor = await mentorContext(browser, baseURL!);
  const training = await createTraining(mentor.context.request, 'Buổi kiểm tra gỡ');
  const first = await memberContext(browser, baseURL!);
  await joinAs(first.page, training, 'An');

  // Same name in the same training: told to pick another, no dead end and no token stored.
  const second = await memberContext(browser, baseURL!);
  await enterCode(second.page, training);
  await second.page.getByLabel('Tên của bạn').fill('an');
  await second.page.getByLabel('Tôi đã đọc và đồng ý').check();
  await second.page.getByRole('button', { name: 'Đồng ý và tiếp tục' }).click();
  await expect(second.page.getByText('Tên này đã có người dùng trong buổi')).toBeVisible();
  expect(await memberToken(second.page, training.id)).toBeNull();
  await second.page.screenshot({ path: shotPath('S36', '1b-name-taken-desktop') });
  await second.page.getByLabel('Tên của bạn').fill('Bình');
  await second.page.getByRole('button', { name: 'Đồng ý và tiếp tục' }).click();
  await expect(second.page.getByRole('heading', { name: 'Làm 3 bước trên laptop có Claude Code' })).toBeVisible();

  const binh = second.page;
  const cfg = await hookConfigOf(request, (await memberToken(binh, training.id))!);
  expect((await mentor.context.request.post(`/api/admin/trainings/${training.id}/stop`)).ok()).toBeTruthy();
  await expect(binh.getByRole('heading', { name: 'Gỡ cấu hình khỏi thư mục bài tập' })).toBeVisible({ timeout: 8000 }); // fast poll while waiting for the first signal
  await binh.getByRole('button', { name: 'Kiểm tra đã gỡ' }).click();
  await expect(binh.getByRole('button', { name: /^Xong \(còn \d giây\)$/ })).toBeDisabled();

  // The hook is still there: an event arrives after the check began. The server answers 200 + a reminder, stores nothing.
  const late = await ingest(request, cfg.ingestToken, promptEvent);
  expect(late.status()).toBe(200);
  expect(((await late.json()) as { systemMessage: string }).systemMessage).toBeTruthy();
  const done = binh.getByRole('button', { name: 'Xong', exact: true });
  await expect(done).toBeEnabled({ timeout: 8000 });
  await done.click();
  await expect(binh.getByRole('heading', { name: 'Tìm chỗ còn sót, rồi kiểm tra lại' })).toBeVisible();
  await expect(binh.getByText('Vẫn còn nhận được tín hiệu').first()).toBeVisible();
  await expect(binh.getByText('/hooks').first()).toBeVisible();
  await expect(binh.locator('[aria-live="polite"]').filter({ hasText: 'vẫn còn nhận được tín hiệu' })).toHaveCount(1);
  await expectNoCollectedContent(binh);
  await tallShot(binh, shotPath('S36', '8c-check-failed-desktop'));
  const stillThere = await (await mentor.context.request.get(`/api/admin/trainings/${training.id}`)).json() as { uninstalled: { count: number }; members: { displayName: string; stillSending: boolean }[] };
  expect(stillThere.uninstalled.count).toBe(0);
  expect(stillThere.members.find(m => m.displayName === 'Bình')?.stillSending).toBe(true);

  // Run it again with nothing sent: passes.
  await binh.getByRole('button', { name: 'Kiểm tra lại' }).click();
  await expect(binh.getByRole('heading', { name: 'Kiểm tra đã gỡ' })).toBeVisible();
  await expect(binh.getByRole('button', { name: 'Xong', exact: true })).toBeEnabled({ timeout: 8000 });
  await binh.getByRole('button', { name: 'Xong', exact: true }).click();
  await expect(binh.getByRole('heading', { name: 'Đã gỡ' })).toBeVisible();

  await finishTraining(mentor.context.request, training.id);
});

test('withdrawing consent deletes the member, clears the token and goes back to the first page', async ({ browser, baseURL, request }) => {
  const mentor = await mentorContext(browser, baseURL!);
  const training = await createTraining(mentor.context.request, 'Buổi rút lại đồng ý');
  const chi = await memberContext(browser, baseURL!);
  await joinAs(chi.page, training, 'Chi');
  const token = (await memberToken(chi.page, training.id))!;
  const cfg = await hookConfigOf(request, token);
  expect(((await (await mentor.context.request.get(`/api/admin/trainings/${training.id}`)).json()) as { members: unknown[] }).members).toHaveLength(1);

  // A broken connection leaves everything as it was and says so.
  await chi.page.getByRole('button', { name: 'Rút lại đồng ý' }).click();
  await chi.context.setOffline(true);
  await chi.page.getByRole('dialog').getByRole('button', { name: 'Rút lại và xoá dữ liệu của tôi' }).click();
  await expect(chi.page.getByRole('dialog')).toContainText('chưa rút lại được');
  expect(await memberToken(chi.page, training.id)).toBe(token);
  await chi.context.setOffline(false);

  await chi.page.getByRole('dialog').getByRole('button', { name: 'Rút lại và xoá dữ liệu của tôi' }).click();
  await expect(chi.page).toHaveURL(/\/$/);
  await expect(chi.page.getByLabel('Mã phòng')).toBeVisible();
  expect(await memberToken(chi.page, training.id)).toBeNull();
  const after = (await (await mentor.context.request.get(`/api/admin/trainings/${training.id}`)).json()) as { members: unknown[] };
  expect(after.members).toHaveLength(0); // nothing of Chi is left on the mentor's side
  expect((await request.get('/api/training/me', { headers: { 'x-training-member-token': token } })).status()).toBe(401);
  expect((await ingest(request, cfg.ingestToken, promptEvent)).status()).toBe(404); // the hook on Chi's machine now reaches nothing

  await finishTraining(mentor.context.request, training.id);
});

test('"Không tham gia" goes back without creating anything; a code-less address and a stopped training say so neutrally', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!);
  const training = await createTraining(mentor.context.request, 'Buổi không tham gia');
  const member = await memberContext(browser, baseURL!);
  await enterCode(member.page, training);
  await member.page.getByRole('button', { name: 'Không tham gia' }).click();
  await expect(member.page).toHaveURL(/\/$/);
  expect(await memberToken(member.page, training.id)).toBeNull();
  expect(((await (await mentor.context.request.get(`/api/admin/trainings/${training.id}`)).json()) as { members: unknown[] }).members).toHaveLength(0);

  // opened without the code: nothing to join with
  await member.page.goto(`/training/${training.id}`);
  await expect(member.page.getByRole('heading', { name: 'Không vào được buổi training' })).toBeVisible();
  await member.page.screenshot({ path: shotPath('S36', '9c-lost-desktop') });
  await member.page.getByRole('button', { name: 'Nhập lại mã phòng' }).click();
  await expect(member.page).toHaveURL(/\/$/);

  // a link with the code that stopped working (the mentor stopped recording): the same neutral message as a wrong code
  await mentor.context.request.post(`/api/admin/trainings/${training.id}/stop`);
  await member.page.goto(`/training/${training.id}?room=${training.roomCode}`);
  await expect(member.page.getByRole('heading', { name: 'Không vào được buổi training' })).toBeVisible();
  await expect(member.page.getByText('Mã phòng không đúng, hoặc buổi training không còn nhận người vào')).toBeVisible();

  await finishTraining(mentor.context.request, training.id);
});

test('a lost connection shows its own state and recovers by itself', async ({ browser, baseURL, request }) => {
  const mentor = await mentorContext(browser, baseURL!);
  const training = await createTraining(mentor.context.request, 'Buổi mất kết nối');
  const member = await memberContext(browser, baseURL!);
  await joinAs(member.page, training, 'Dũng');
  const cfg = await hookConfigOf(request, (await memberToken(member.page, training.id))!);
  await ingest(request, cfg.ingestToken, promptEvent);
  await expect(member.page.getByRole('heading', { name: 'Đã nhận tín hiệu' })).toBeVisible({ timeout: 5000 });

  await member.context.setOffline(true);
  await expect(member.page.getByText('Mất kết nối tới máy mentor').first()).toBeVisible({ timeout: 15_000 });
  await expect(member.page.getByRole('heading', { name: 'Đã nhận tín hiệu' })).toBeVisible(); // what is known stays on screen
  await member.page.screenshot({ path: shotPath('S36', '9b-offline-banner-desktop') });
  await member.context.setOffline(false);
  await expect(member.page.getByText('Mất kết nối tới máy mentor')).toBeHidden({ timeout: 8000 });

  await finishTraining(mentor.context.request, training.id);
});

test('after about a minute without a signal the install screen suggests what may be wrong', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!);
  const training = await createTraining(mentor.context.request, 'Buổi chờ lâu');
  const member = await memberContext(browser, baseURL!);
  await member.page.clock.install();
  await joinAs(member.page, training, 'Hà');
  await expect(member.page.getByText('Chưa thấy tín hiệu sau 1 phút')).toBeHidden();
  await member.page.clock.fastForward(65_000);
  await expect(member.page.getByText('Chưa thấy tín hiệu sau 1 phút')).toBeVisible();
  await expect(member.page.getByText('proxy hoặc phần mềm của công ty')).toBeVisible();
  await tallShot(member.page, shotPath('S36', '4b-waiting-hint-desktop'));
  await finishTraining(mentor.context.request, training.id);
});

test('an exam room code still goes to the exam join form, unchanged', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!);
  const examId = await importExam(mentor.context.request);
  const session = await makeSession(mentor.context.request, examId);
  const member = await memberContext(browser, baseURL!);
  await member.page.goto('/');
  await member.page.getByLabel('Mã phòng').fill(session.roomCode);
  await expect(member.page.getByLabel('Tên của bạn')).toBeVisible();
  await expect(member.page).toHaveURL(/\/$/); // no detour to /training
  await member.page.getByLabel('Tên của bạn').fill('An');
  await member.page.getByRole('button', { name: 'Vào phòng' }).click();
  await expect(member.page.getByText('An').first()).toBeVisible();
  for (const step of ['start', 'close']) await mentor.context.request.post(`/api/admin/sessions/${session.id}/${step}`);
});
