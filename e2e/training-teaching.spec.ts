import { readFile } from 'node:fs/promises';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { PHONE, memberContext, mentorContext, shotPath } from './helpers';

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

/** The "Xuất" menu: one button, three files. */
async function openExport(page: Page, item: RegExp) {
  await page.getByRole('button', { name: 'Xuất', exact: true }).click();
  await page.getByRole('menuitem', { name: item }).click();
}

test('a member ticks the teaching consent; the mentor makes examples, reviews each, and downloads an anonymous file; a member who did not tick has no button', async ({ browser, baseURL, request }) => {
  test.setTimeout(180_000);
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
  const teaching = lan.page.getByLabel('Cho mentor dùng prompt của tôi (đã bỏ tên) làm ví dụ');
  await expect(teaching).not.toBeChecked(); // never pre-ticked
  for (const must of ['Dùng prompt của bạn làm ví dụ', 'Tuỳ chọn', 'Bắt buộc để tham gia', 'Không bắt buộc, mặc định không tick', 'chưa tốt', 'Mentor sẽ biết bạn đã tick', 'người cùng lớp vẫn có thể đoán ra từ nội dung', 'Dừng gửi không rút lại việc dùng prompt đã gửi', 'không thu hồi được']) {
    await expect(lan.page.getByText(must).first()).toBeVisible();
  }
  await expect(lan.page.getByText(/lớp sau|khoá sau/)).toHaveCount(0);
  const summary = lan.page.locator('[data-consent-summary]');
  await expect(summary).toHaveText('Bạn đang chọn: Chưa đồng ý tham gia · Làm ví dụ: Không');
  await lan.page.getByLabel('Tôi đã đọc và đồng ý').check();
  await expect(summary).toHaveText('Bạn đang chọn: Tham gia · Làm ví dụ: Không');
  await expect(lan.page.getByRole('button', { name: 'Đồng ý và tiếp tục' })).toBeEnabled(); // the optional box does not gate joining
  await teaching.check();
  await expect(summary).toHaveText('Bạn đang chọn: Tham gia · Làm ví dụ: Có');
  await tallShot(lan.page, shotPath('S44', '1-man-dong-y'));

  // the same screen on a phone: no sideways scroll, boxes big enough to tap
  const phone = await memberContext(browser, baseURL!, PHONE);
  await phone.page.goto('/');
  await phone.page.getByLabel('Mã phòng').fill(training.roomCode);
  await expect(phone.page).toHaveURL(new RegExp(`/training/${training.id}`));
  await phone.page.getByLabel('Tôi đã đọc và đồng ý').check();
  await phone.page.locator('[data-consent-summary]').scrollIntoViewIfNeeded();
  const overflow = await phone.page.evaluate(() => [...document.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > window.innerWidth + 1).length);
  expect(overflow).toBe(0);
  for (const label of ['Cho mentor dùng prompt của tôi (đã bỏ tên) làm ví dụ', 'Tôi đã đọc và đồng ý']) {
    const box = await phone.page.locator('label', { has: phone.page.getByLabel(label) }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await phone.page.screenshot({ path: shotPath('S44', '1b-man-dong-y-dien-thoai') });
  await phone.context.close();

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
  await send(lanIngest, bash('cat /home/lan/bai-tap/cart.ts', OUTPUT));
  await send(lanIngest, prompt('chạy lại test'));
  await send(maiIngest, prompt('viết hàm tính tổng'));

  // ── Mentor: Lan's first prompt becomes an example ──────────────────────────────────────────────────
  await page.goto(`/admin/trainings/${training.id}`);
  await page.getByRole('button', { name: 'Lan', exact: true }).click();
  const timeline = page.getByLabel('Các sự kiện, ngày mới nhất ở trên');
  await expect(timeline.getByText('chạy lại test')).toBeVisible({ timeout: 6_000 });
  const lanFirst = timeline.locator('[data-turn-key]', { hasText: 'Cafe Hoa Mai' });
  const lanSecond = timeline.locator('[data-turn-key]', { hasText: 'chạy lại test' });
  await expect(lanFirst.getByRole('button', { name: 'Đánh dấu cho báo cáo' })).toContainText('Báo cáo'); // the S40 mark says what it is for
  await lanFirst.getByRole('button', { name: 'Làm ví dụ' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ví dụ', exact: true });
  await expect(dialog.getByRole('button', { name: 'Lưu ví dụ' })).toBeDisabled(); // no label, no comment yet
  await dialog.getByRole('radio', { name: /Chưa tốt/ }).click();
  await dialog.getByLabel('Chủ đề').selectOption('verify');
  await dialog.getByLabel('Nhận xét (bắt buộc)').fill('Không nói cách kiểm tra kết quả nên Claude không biết khi nào xong.');
  await dialog.getByLabel('Phiên bản tốt hơn (tuỳ chọn)').fill('Sửa lỗi tổng giỏ hàng, chạy npm test và báo kết quả.');
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath('S44', '2-hop-thoai-vi-du') });
  await dialog.getByRole('button', { name: 'Lưu ví dụ' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(lanFirst.getByRole('button', { name: 'Ví dụ: Chưa tốt' })).toBeVisible(); // icon + words, neutral grey
  // The second prompt becomes an example too ("Tốt", another topic).
  await lanSecond.getByRole('button', { name: 'Làm ví dụ' }).click();
  await dialog.getByRole('radio', { name: /Tốt/ }).click();
  await dialog.getByLabel('Nhận xét (bắt buộc)').fill('Ngắn nhưng rõ: chạy lại đúng việc vừa làm.');
  await dialog.getByRole('button', { name: 'Lưu ví dụ' }).click();
  await expect(lanSecond.getByRole('button', { name: 'Ví dụ: Tốt' })).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath('S44', '2b-dong-thoi-gian') });

  // Mai did not agree: no button on her prompts, a chip at the top of her timeline says why.
  await page.getByRole('button', { name: 'Mai', exact: true }).click();
  await expect(timeline.getByText('viết hàm tính tổng')).toBeVisible({ timeout: 6_000 });
  await expect(page.locator('[data-no-teaching]')).toHaveText('Không dùng làm ví dụ');
  await expect(page.locator('[data-no-teaching]')).toHaveAttribute('title', 'Bạn này không đồng ý cho dùng làm ví dụ');
  await expect(page.locator('[data-teaching]')).toHaveCount(0);
  await expect(timeline.getByRole('button', { name: 'Đánh dấu cho báo cáo' })).toHaveCount(1); // the report mark stays
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath('S44', '3-thanh-vien-khong-dong-y') });

  // ── The "Xuất" menu: one button, keyboard friendly ─────────────────────────────────────────────────
  await expect(page.getByRole('button', { name: 'Xuất báo cáo' })).toHaveCount(0); // the three buttons are gone
  const trigger = page.getByRole('button', { name: 'Xuất', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu', { name: 'Xuất' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveCount(3);
  for (const must of ['Báo cáo buổi', 'Có tên', 'Dữ liệu thô để phân tích (.zip)', 'Có tên + output', 'Rà & xuất ví dụ…', 'Không tên']) await expect(menu.getByText(must, { exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem').nth(1)).toBeFocused();
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath('S44', '5-menu-xuat') });
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // ── Review: each example on its own ────────────────────────────────────────────────────────────────
  await openExport(page, /Rà & xuất ví dụ/);
  const review = page.getByRole('dialog', { name: 'Rà & xuất ví dụ' });
  await expect(review).toBeFocused(); // opened from the menu: the focus is inside
  const download = review.locator('[data-download]');
  await expect(review.getByRole('progressbar', { name: 'Đã rà' })).toHaveAttribute('aria-valuenow', '0');
  await expect(download).toBeDisabled();
  await expect(download).toHaveText('Tải file .md · còn 2 chưa rà');
  const nav = review.getByRole('navigation', { name: 'Danh sách ví dụ' });
  await expect(nav.getByText('Kiểm chứng', { exact: true })).toBeVisible(); // grouped by topic
  await expect(nav.getByText('Khác', { exact: true })).toBeVisible();
  const promptBox = review.getByLabel('Prompt trong file');
  const contextBox = review.getByLabel(/^Bối cảnh/);
  await expect(promptBox).toHaveValue(/Cafe Hoa Mai/);
  await expect(promptBox).not.toHaveValue(new RegExp(SECRET)); // masked already
  await expect(contextBox).toHaveValue('✓ Bash npm test\n✓ Bash cat ~/bai-tap/cart.ts'); // commands only, home folder replaced by ~
  await expect(review.locator('[data-masked]').first()).toBeAttached();
  await expect(review.getByText('Của Lan · chỉ bạn thấy, không có trong file')).toBeVisible();
  // "Mai" in "Cafe Hoa Mai" looks like the name of a member: flagged, highlighted, and the list says so.
  const warning = review.locator('[data-name-warning]');
  await expect(warning).toContainText('“Mai” trong prompt');
  await expect(review.locator('mark')).toHaveText('Mai');
  await expect(nav.getByText('1 chỗ nghi là tên · chưa rà')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath('S44', '4-man-ra-soat') });
  await warning.getByRole('button', { name: 'Không phải tên' }).click();
  await expect(warning).toHaveCount(0);
  await expect(nav.getByText('Chưa rà').first()).toBeVisible();

  // Edit the prompt: saved when the box loses focus; "Về bản gốc" brings the masked original back.
  await promptBox.fill('Sửa lỗi giỏ hàng của dự án giúp mình');
  await promptBox.blur();
  await expect(review.getByText('Đã lưu bản sửa')).toBeVisible();
  await expect(review.getByText('Đã sửa', { exact: true })).toBeVisible();
  await review.getByRole('button', { name: 'Khôi phục bản app đã che' }).click();
  await expect(promptBox).toHaveValue(/Cafe Hoa Mai/);
  await promptBox.fill('Lan đây: sửa lỗi giỏ hàng của dự án giúp mình');
  await expect(warning).toContainText('“Lan” trong prompt');
  await warning.getByRole('button', { name: 'Thay bằng “[bạn]”' }).click();
  await expect(promptBox).toHaveValue('[bạn] đây: sửa lỗi giỏ hàng của dự án giúp mình');
  await promptBox.fill('Sửa lỗi giỏ hàng của dự án giúp mình');
  await promptBox.blur();
  await expect(warning).toHaveCount(0);

  // "Đã rà ví dụ này, sang tiếp" saves, marks it and moves on; the file stays locked until none is left.
  await review.locator('[data-mark-reviewed]').click();
  await expect(review.getByRole('progressbar', { name: 'Đã rà' })).toHaveAttribute('aria-valuenow', '1');
  await expect(review.getByText('Ví dụ 2', { exact: true }).first()).toBeVisible();
  await expect(promptBox).toHaveValue('chạy lại test');
  await expect(download).toHaveText('Tải file .md · còn 1 chưa rà');
  await expect(download).toBeDisabled();
  // The review is kept on the server: closing and reopening shows it.
  await review.getByRole('button', { name: 'Đóng' }).click();
  await openExport(page, /Rà & xuất ví dụ/);
  await expect(review.getByRole('progressbar', { name: 'Đã rà' })).toHaveAttribute('aria-valuenow', '1');
  await expect(nav.getByText('Đã rà · 1 trường đã sửa')).toBeVisible();
  await expect(promptBox).toHaveValue('chạy lại test'); // opens on the first one not reviewed
  // Fixing a name typed in a comment (the design's second warning case) also works from here.
  await review.getByLabel('Nhận xét').fill('Thanh toán giỏ hàng, chạy lại lần nữa.'); // ordinary words that contain "an" / "lan" with other accents: no warning
  await expect(warning).toHaveCount(0);
  await review.getByLabel('Nhận xét').fill('Ngắn nhưng rõ, giống cách Mai viết.');
  await expect(warning).toContainText('“Mai” trong nhận xét');
  await warning.getByRole('button', { name: 'Thay bằng “[bạn]”' }).click();
  await expect(review.getByLabel('Nhận xét')).toHaveValue('Ngắn nhưng rõ, giống cách [bạn] viết.');
  await review.locator('[data-mark-reviewed]').click();
  await expect(review.getByRole('progressbar', { name: 'Đã rà' })).toHaveAttribute('aria-valuenow', '2');
  await expect(download).toBeEnabled();
  await expect(download).toHaveText('Tải file .md');

  // Editing a reviewed example takes it back to "chưa rà" and locks the file again.
  await nav.getByRole('button', { name: /Ví dụ 1/ }).click();
  await promptBox.fill('Sửa lỗi giỏ hàng của dự án nhé');
  await promptBox.blur();
  await expect(download).toBeDisabled();
  await expect(download).toHaveText('Tải file .md · còn 1 chưa rà');
  await review.locator('[data-mark-reviewed]').click();
  await expect(download).toBeEnabled();

  const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
  expect(file.suggestedFilename()).toBe('vi-du-claude-code-buoi-5-vi-du.md');
  const text = await readFile((await file.path())!, 'utf8');
  expect(text).toContain('# Ví dụ prompt để dạy: Claude Code buổi 5: ví dụ');
  expect(text).toContain('Sửa lỗi giỏ hàng của dự án nhé'); // the edit wins over the original
  expect(text).not.toContain('Cafe Hoa Mai');
  expect(text).toContain('✓ Bash cat ~/bai-tap/cart.ts');
  expect(text).toContain('Không nói cách kiểm tra kết quả');
  expect(text).toContain('Sửa lỗi tổng giỏ hàng, chạy npm test và báo kết quả.');
  expect(text).toContain('giống cách [bạn] viết');
  for (const hidden of ['Lan', 'Mai', SECRET, 'OUTPUT-S44-ONLY', 'viết hàm tính tổng', SID, CWD, '/home/lan']) expect(text, hidden).not.toContain(hidden);
  expect(text).not.toMatch(/\d{1,2}:\d{2}/);
  await expect(review.getByText('Đã tải file về máy')).toBeVisible();

  // ── "Ẩn nội dung" (H): the review shows no content and offers no file ───────────────────────────────
  await page.keyboard.press('h');
  await expect(review.getByText('Nội dung đang ẩn nên không rà ở đây')).toBeVisible();
  await expect(review.getByLabel('Prompt trong file')).toHaveCount(0);
  await expect(review.locator('[data-download]')).toBeDisabled();
  await page.keyboard.press('h');
  await expect(review.getByLabel('Prompt trong file')).toBeVisible();

  // An edit after the download makes the example count again; ending reminds, and the reminder opens the right screen.
  await promptBox.fill('Sửa lỗi giỏ hàng của dự án, báo kết quả');
  await promptBox.blur();
  await expect(review.getByText('Đã lưu bản sửa')).toBeVisible();
  await review.getByRole('button', { name: 'Đóng' }).click();
  await page.getByRole('button', { name: 'Dừng thu' }).click();
  await page.getByRole('dialog', { name: 'Dừng thu?' }).getByRole('button', { name: 'Dừng thu' }).click();
  await page.getByRole('button', { name: 'Kết thúc', exact: true }).click();
  const endDialog = page.getByRole('dialog', { name: 'Kết thúc và xoá dữ liệu?' });
  await expect(endDialog.getByText('Còn 1 ví dụ chưa xuất.')).toBeVisible();
  await expect(endDialog.getByText('Bạn chưa xuất báo cáo.')).toBeVisible(); // the two reminders sit together
  await expect(endDialog.getByText('Các dấu đánh dấu cho báo cáo và ghi chú cũng mất khi kết thúc.')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath('S44', '6-nhac-khi-ket-thuc') });
  await endDialog.getByRole('button', { name: 'Xuất ví dụ trước' }).click();
  await expect(review).toBeVisible();
  await expect(download).toBeDisabled(); // the edit made it "chưa rà" again
  await review.locator('[data-mark-reviewed]').click();
  await Promise.all([page.waitForEvent('download'), download.click()]);
  await review.getByRole('button', { name: 'Đóng' }).click();
  await page.getByRole('button', { name: 'Kết thúc', exact: true }).click();
  await expect(endDialog.getByText(/ví dụ chưa xuất/)).toHaveCount(0); // exported: no reminder, ending is still allowed
  await endDialog.getByRole('button', { name: 'Huỷ' }).click();

  // ── Drop the examples: the export says there is none ───────────────────────────────────────────────
  await page.getByRole('button', { name: 'Lan', exact: true }).click();
  for (const label of ['Ví dụ: Chưa tốt', 'Ví dụ: Tốt']) {
    await timeline.getByRole('button', { name: label }).click();
    await dialog.getByRole('button', { name: 'Bỏ ví dụ này' }).click();
    await expect(dialog).toHaveCount(0);
  }
  await expect(timeline.getByRole('button', { name: 'Làm ví dụ' })).toHaveCount(2);
  await openExport(page, /Rà & xuất ví dụ/);
  await expect(review.getByText('Chưa có ví dụ nào.')).toBeVisible();
  await expect(review.locator('[data-download]')).toBeDisabled();
  await review.getByRole('button', { name: 'Đóng' }).click();

  for (const step of ['end']) await mentor.context.request.post(`/api/admin/trainings/${training.id}/${step}`);
});
