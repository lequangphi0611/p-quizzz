import { readFile } from 'node:fs/promises';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { memberContext, mentorContext, shotPath } from './helpers';

// S44 — teaching examples (PRODUCT.md §7.39): a member ticks the separate consent, the mentor labels a prompt, reviews and edits
// the example, ticks "Tôi đã rà" and downloads an anonymous file. A member who did not tick has a locked button.
// Screenshots go to docs/design/S44-assets/.

const CWD = '/home/lan/bai-tap-training';
const SID = 'dddd4444-0000-4000-8000-000000000001';
const base = { session_id: SID, transcript_path: `${CWD}/t.jsonl`, cwd: CWD, permission_mode: 'default' };
const prompt = (text: string) => ({ ...base, hook_event_name: 'UserPromptSubmit', prompt: text });
const bash = (command: string, stdout: string) => ({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command }, tool_response: { stdout, stderr: '', interrupted: false }, duration_ms: 200 });

const PROMPT_TEXT = 'Sửa lỗi giỏ hàng của dự án Cafe Hoa Mai giúp mình';
const SECRET = 'sk-abcdefghijklmnopqrstuvwxyz123456';
const OUTPUT = 'PASS cart.test.ts OUTPUT-S44-ONLY';

const ingestTokenOf = async (request: APIRequestContext, token: string) => {
  const res = await request.get('/api/training/me/hook-config', { headers: { 'x-training-member-token': token } });
  const cfg = (await res.json()) as { settings: { hooks: { PostToolUse: { hooks: { headers: Record<string, string> }[] }[] } } };
  return cfg.settings.hooks.PostToolUse[0]!.hooks[0]!.headers['X-Training-Token']!;
};

const memberToken = (page: Page, id: number) => page.evaluate(i => localStorage.getItem(`pq:training:${i}`), id);

/** The long consent screen scrolls inside the page frame: a tall window lets the whole of it be captured. */
async function tallShot(page: Page, path: string) {
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.width, height: 2600 });
  await page.locator('[data-pq-focus]').screenshot({ path });
  await page.setViewportSize(size);
}

test('a member ticks the teaching consent; the mentor makes, reviews and downloads an anonymous example; a member who did not tick is locked', async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  const mentor = await mentorContext(browser, baseURL!);
  const created = await mentor.context.request.post('/api/admin/trainings', { data: { name: 'Claude Code buổi 5: ví dụ' } });
  const training = (await created.json()) as { id: number; roomCode: string };
  const page = mentor.page;

  // ── Member Lan ticks the separate box ──────────────────────────────────────────────────────────────
  const lan = await memberContext(browser, baseURL!);
  await lan.page.goto('/');
  await lan.page.getByLabel('Mã phòng').fill(training.roomCode);
  await expect(lan.page).toHaveURL(new RegExp(`/training/${training.id}`));
  await lan.page.getByLabel('Tên của bạn').fill('Lan');
  const teaching = lan.page.getByLabel('Cho mentor dùng prompt của tôi (đã bỏ tên) làm ví dụ dạy các khoá sau');
  await expect(teaching).not.toBeChecked(); // never pre-ticked
  for (const must of ['không bắt buộc', 'Không bắt buộc, mặc định không tick', 'chưa tốt', 'Mentor sẽ biết bạn đã tick', 'Dừng gửi không rút lại việc dùng prompt đã gửi', 'không thu hồi được']) {
    await expect(lan.page.getByText(must).first()).toBeVisible();
  }
  await lan.page.getByLabel('Tôi đã đọc và đồng ý').check();
  await expect(lan.page.getByRole('button', { name: 'Đồng ý và tiếp tục' })).toBeEnabled(); // the optional box does not gate joining
  await teaching.check();
  await tallShot(lan.page, shotPath('S44', '1-man-dong-y'));
  await lan.page.getByRole('button', { name: 'Đồng ý và tiếp tục' }).click();
  await expect(lan.page.getByRole('heading', { name: 'Làm 3 bước trên laptop có Claude Code' })).toBeVisible();
  const lanIngest = await ingestTokenOf(request, (await memberToken(lan.page, training.id))!);

  // ── Member Mai joins without ticking ───────────────────────────────────────────────────────────────
  const mai = await memberContext(browser, baseURL!);
  await mai.page.goto('/');
  await mai.page.getByLabel('Mã phòng').fill(training.roomCode);
  await expect(mai.page).toHaveURL(new RegExp(`/training/${training.id}`));
  await mai.page.getByLabel('Tên của bạn').fill('Mai');
  await mai.page.getByLabel('Tôi đã đọc và đồng ý').check();
  await mai.page.getByRole('button', { name: 'Đồng ý và tiếp tục' }).click();
  await expect(mai.page.getByRole('heading', { name: 'Làm 3 bước trên laptop có Claude Code' })).toBeVisible();
  const maiIngest = await ingestTokenOf(request, (await memberToken(mai.page, training.id))!);

  const send = (token: string, payload: unknown) => request.post('/api/training/ingest', { headers: { 'X-Training-Token': token }, data: payload });
  await send(lanIngest, prompt(`${PROMPT_TEXT}, khoá ${SECRET}`));
  await send(lanIngest, bash('npm test', OUTPUT));
  await send(lanIngest, prompt('chạy lại test'));
  await send(maiIngest, prompt('viết hàm tính tổng'));

  // ── Mentor: Lan's prompt becomes an example ────────────────────────────────────────────────────────
  await page.goto(`/admin/trainings/${training.id}`);
  await page.getByRole('button', { name: 'Lan', exact: true }).click();
  const timeline = page.getByLabel('Các sự kiện, ngày mới nhất ở trên');
  await expect(timeline.getByText('chạy lại test')).toBeVisible({ timeout: 6_000 });
  const lanFirst = timeline.locator('[data-turn-key]', { hasText: 'Cafe Hoa Mai' });
  await lanFirst.getByRole('button', { name: 'Ví dụ dạy lớp sau' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ví dụ dạy lớp sau' });
  await expect(dialog.getByRole('button', { name: 'Lưu ví dụ' })).toBeDisabled(); // no label, no comment yet
  await dialog.getByRole('radio', { name: /Chưa tốt/ }).click();
  await dialog.getByLabel('Chủ đề').selectOption('verify');
  await dialog.getByLabel('Nhận xét (bắt buộc)').fill('Không nói cách kiểm tra kết quả nên Claude không biết khi nào xong.');
  await dialog.getByLabel('Phiên bản tốt hơn (tuỳ chọn)').fill('Sửa lỗi tổng giỏ hàng, chạy npm test và báo kết quả.');
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath('S44', '2-hop-thoai-vi-du') });
  await dialog.getByRole('button', { name: 'Lưu ví dụ' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(lanFirst.getByRole('button', { name: 'Ví dụ: Chưa tốt' })).toBeVisible(); // icon + words, not colour alone

  // Mai did not agree: the button is locked with the reason.
  await page.getByRole('button', { name: 'Mai', exact: true }).click();
  const locked = page.locator('[data-teaching-state="locked"]').first();
  await expect(locked).toBeVisible({ timeout: 6_000 });
  await expect(locked).toHaveAttribute('title', 'Bạn này không đồng ý cho dùng làm ví dụ');
  await expect(locked).toHaveAttribute('aria-disabled', 'true');
  await locked.click({ force: true });
  await expect(page.getByRole('dialog', { name: 'Ví dụ dạy lớp sau' })).toHaveCount(0);
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath('S44', '3-nut-khoa') });

  // ── Review: edit the prompt, tick, download ────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Xuất ví dụ dạy lớp sau' }).click();
  const review = page.getByRole('dialog', { name: 'Xuất ví dụ dạy lớp sau' });
  const download = review.getByRole('button', { name: 'Tải file .md' });
  await expect(download).toBeDisabled();
  const promptBox = review.getByLabel('Prompt trong file');
  const contextBox = review.getByLabel(/^Bối cảnh/);
  await expect(promptBox).toHaveValue(/Cafe Hoa Mai/);
  await expect(promptBox).not.toHaveValue(new RegExp(SECRET)); // masked already
  await expect(contextBox).toHaveValue('✓ Bash npm test'); // commands only: no output
  await expect(review.getByText('Của Lan (chỉ bạn thấy, không có trong file)')).toBeVisible();
  await expect(review.locator('[data-name-warning]')).toContainText('"Mai" trong prompt'); // "Cafe Hoa Mai" holds the name of a member
  await promptBox.fill('Lan đây: sửa lỗi giỏ hàng của dự án giúp mình');
  await expect(review.locator('[data-name-warning]')).toContainText('"Lan" trong prompt');
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath('S44', '5-canh-bao-ten') });
  await promptBox.fill('Sửa lỗi giỏ hàng của dự án giúp mình');
  await expect(review.locator('[data-name-warning]')).toHaveCount(0);
  await promptBox.blur();
  await expect(review.getByText('Đã lưu bản sửa')).toBeVisible();
  await expect(review.getByRole('button', { name: 'Về bản gốc' })).toBeEnabled();
  await review.getByLabel('Tôi đã rà, không còn chi tiết nhận ra người viết').check();
  await expect(download).toBeEnabled();
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath('S44', '4-man-ra-soat') });

  // Editing again takes the tick away.
  await contextBox.fill('✓ Bash npm test\n✗ Bash npm run lint');
  await expect(review.getByLabel('Tôi đã rà, không còn chi tiết nhận ra người viết')).not.toBeChecked();
  await expect(download).toBeDisabled();
  await review.getByLabel('Tôi đã rà, không còn chi tiết nhận ra người viết').check();

  const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
  expect(file.suggestedFilename()).toBe('vi-du-day-claude-code-buoi-5-vi-du.md');
  const text = await readFile((await file.path())!, 'utf8');
  expect(text).toContain('# Ví dụ prompt để dạy: Claude Code buổi 5: ví dụ');
  expect(text).toContain('Sửa lỗi giỏ hàng của dự án giúp mình'); // the edit wins over the original
  expect(text).not.toContain('Cafe Hoa Mai');
  expect(text).toContain('✗ Bash npm run lint');
  expect(text).toContain('Không nói cách kiểm tra kết quả');
  expect(text).toContain('Sửa lỗi tổng giỏ hàng, chạy npm test và báo kết quả.');
  for (const hidden of ['Lan', 'Mai', SECRET, 'OUTPUT-S44-ONLY', 'viết hàm tính tổng', 'chạy lại test', SID, CWD]) expect(text, hidden).not.toContain(hidden);
  expect(text).not.toMatch(/\d{1,2}:\d{2}/);
  await expect(review.getByText('Đã tải file về máy')).toBeVisible();

  // ── "Ẩn nội dung" (H): the review shows no content and offers no file ───────────────────────────────
  await review.getByRole('button', { name: 'Đóng' }).click();
  await page.keyboard.press('h');
  await page.getByRole('button', { name: 'Xuất ví dụ dạy lớp sau' }).click();
  await expect(review.getByText('Nội dung đang ẩn nên không rà ở đây')).toBeVisible();
  await expect(review.getByLabel('Prompt trong file')).toHaveCount(0);
  await expect(review.getByRole('button', { name: /^Tải/ })).toBeDisabled();
  await page.keyboard.press('h');
  await expect(review.getByLabel('Prompt trong file')).toBeVisible();
  await review.getByRole('button', { name: 'Đóng' }).click();

  // ── Drop the example: the export says there is none ────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Lan', exact: true }).click();
  await lanFirst.getByRole('button', { name: 'Ví dụ: Chưa tốt' }).click();
  await expect(dialog.getByLabel('Nhận xét (bắt buộc)')).toHaveValue(/Không nói cách kiểm tra/);
  await dialog.getByRole('button', { name: 'Bỏ ví dụ này' }).click();
  await expect(lanFirst.getByRole('button', { name: 'Ví dụ dạy lớp sau' })).toBeVisible();
  await page.getByRole('button', { name: 'Xuất ví dụ dạy lớp sau' }).click();
  await expect(review.getByText('Chưa có ví dụ nào.')).toBeVisible();
  await expect(review.getByRole('button', { name: /^Tải/ })).toBeDisabled();
  await review.getByRole('button', { name: 'Đóng' }).click();

  for (const step of ['stop', 'end']) await mentor.context.request.post(`/api/admin/trainings/${training.id}/${step}`);
});
