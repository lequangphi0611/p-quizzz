import { resolve } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { importExam, makeSession, memberContext, mentorContext, PHONE, shotPath } from './helpers';

// S30 (PRODUCT.md §7.32): "{reason}" questions. Exam (shuffle off): Câu 1 single + lý do (B đúng) · Câu 2 single ·
// Câu 3 multi + lý do (A + C đúng).
const EXAM = resolve('exams/examples/react-hooks-ly-do.md');

test('reason box: required with a pick, blocks a manual submit, anonymous on the projector', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!, { width: 1920, height: 1080 });
  const api = mentor.context.request;
  const examId = await importExam(api, EXAM);
  const { id, roomCode } = await makeSession(api, examId, { extra: { shuffle: false } });

  const join = async (b: Browser, name: string, viewport?: { width: number; height: number }) => {
    const m = await memberContext(b, baseURL!, viewport);
    await m.page.goto(`/?room=${roomCode}`);
    await m.page.getByLabel('Tên của bạn').fill(name);
    await m.page.getByRole('button', { name: 'Vào phòng' }).click();
    await expect(m.page.getByText(name).first()).toBeVisible();
    return m.page;
  };
  const an = await join(browser, 'An');
  const binh = await join(browser, 'Bình', PHONE);
  const chi = await join(browser, 'Chi');
  await api.post(`/api/admin/sessions/${id}/start`);

  const reasonBox = (p: Page) => p.getByLabel('Lý do (bắt buộc, không tính điểm)');
  const waitSaved = (p: Page) => expect(p.getByText('Đã lưu').first()).toBeVisible();

  // ── An (laptop): forgets the reason on Câu 3, gets stopped, fixes it from the dialog ──
  await expect(reasonBox(an)).toBeVisible();
  await an.getByRole('radio').nth(1).click();
  await expect(an.getByText('Ghi lý do để nộp được bài')).toBeVisible();
  await reasonBox(an).fill('visible tính được từ products và query nên không cần state riêng');
  await an.keyboard.press('Escape');
  await an.keyboard.press('ArrowRight');
  await expect(reasonBox(an)).toHaveCount(0); // Câu 2 asks no reason
  await an.getByRole('radio').nth(1).click();
  await an.keyboard.press('ArrowRight');
  await an.getByRole('checkbox').nth(0).click();
  await an.getByRole('checkbox').nth(2).click();
  await waitSaved(an);
  await expect(an.getByRole('navigation', { name: 'Danh sách câu' }).getByText('Thiếu lý do')).toHaveCount(1); // Câu 3, also on the current row
  await an.emulateMedia({ reducedMotion: 'reduce' });
  await an.getByRole('button', { name: 'Nộp bài' }).first().click();
  const missing = an.getByRole('dialog');
  await expect(missing.getByText('Còn câu chưa ghi lý do')).toBeVisible();
  await expect(missing.getByRole('button', { name: 'Nộp bài' })).toBeDisabled();
  await an.screenshot({ path: shotPath('S30', 'member-missing-reason') });
  await missing.getByRole('button', { name: 'Câu 3' }).click();
  await reasonBox(an).fill('resize là API trình duyệt, gọi API là đồng bộ với mạng');
  await waitSaved(an);
  await an.getByRole('button', { name: 'Nộp bài' }).first().click();
  await an.getByRole('dialog').getByRole('button', { name: 'Nộp bài' }).click();
  await expect(an.getByText('Đã nộp').first()).toBeVisible();

  // ── Bình (phone): reason on Câu 1, F5 keeps it, leaves Câu 3 blank (needs no reason) ──
  await binh.getByRole('radio').nth(0).click();
  await reasonBox(binh).fill('Dữ liệu thay đổi thì phải để vào state mới re-render được');
  await waitSaved(binh);
  await binh.reload();
  await expect(reasonBox(binh)).toHaveValue('Dữ liệu thay đổi thì phải để vào state mới re-render được');
  await reasonBox(binh).scrollIntoViewIfNeeded();
  await binh.screenshot({ path: shotPath('S30', 'member-phone-reason') });
  await binh.getByRole('button', { name: 'Nộp bài' }).click();
  await binh.getByRole('dialog').getByRole('button', { name: 'Nộp bài' }).click();
  await expect(binh.getByText('Đã nộp').first()).toBeVisible();

  // ── Chi: picks without a reason and never submits; closing the session submits it anyway ──
  await chi.getByRole('radio').nth(0).click();
  await waitSaved(chi);
  expect((await api.post(`/api/admin/sessions/${id}/close`)).ok()).toBeTruthy();

  // ── Projector ──
  const page = mentor.page;
  await page.emulateMedia({ reducedMotion: 'reduce' }); // screenshots without half-faded reveals
  await page.goto(`/admin/sessions/${id}/discuss`);
  await expect(page.getByRole('heading', { name: /danh sách sản phẩm đã lọc/ })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Lý do: đang ẩn' })).toBeVisible();
  await expect(page.getByText('Lý do của lớp')).toHaveCount(0);
  await page.keyboard.press('r');
  await expect(page.getByRole('heading', { name: 'Lý do của lớp' })).toBeFocused();
  await expect(page.getByText('visible tính được từ products')).toBeVisible();
  await expect(page.getByText('Dữ liệu thay đổi thì phải để vào state')).toBeVisible();
  await expect(page.getByText('1 người chọn nhưng chưa ghi lý do')).toBeVisible(); // Chi
  await expect(page.getByText('Không ai chọn').first()).toBeVisible();
  for (const name of ['An', 'Bình', 'Chi']) await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  await expect(page.getByText('Đáp án đúng')).toHaveCount(0);
  await page.screenshot({ path: shotPath('S30', 'discussion-reasons') });
  await page.keyboard.press(' ');
  await expect(page.getByText('Đáp án đúng')).toBeVisible();
  await page.screenshot({ path: shotPath('S30', 'discussion-reasons-answer') });

  // A group collapses; a new question hides the block again.
  await page.getByRole('button', { name: 'Thu gọn' }).first().click();
  await expect(page.getByRole('button', { name: 'Mở tất cả nhóm' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Lý do của lớp')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Hiện lý do/ })).toHaveCount(0); // Câu 2 asks no reason
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: /Hiện lý do/ }).click();
  await expect(page.getByText('resize là API trình duyệt')).toBeVisible();
  await page.screenshot({ path: shotPath('S30', 'discussion-multi') });

  // ── An's review: only An's own reasons ──
  await an.goto('/');
  await an.getByRole('link', { name: /Xem lại bài/ }).or(an.getByRole('button', { name: /Xem lại bài/ })).first().click();
  await expect(an.getByText('Lý do của bạn').first()).toBeVisible();
  await expect(an.getByText('visible tính được từ products')).toBeVisible();
  await expect(an.getByText('Dữ liệu thay đổi thì phải để vào state')).toHaveCount(0);
});
