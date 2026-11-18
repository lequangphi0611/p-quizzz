import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { DESKTOP, PHONE, importExam, memberContext, mentorContext, shotPath } from './helpers';

// S25 (PRODUCT.md §7.27) — time limit: the exam's `duration` preselects the limit, one clock for the room, the session
// closes itself when it runs out and the member's work is submitted. The fixture exam lasts 1 minute (the real wait).
test('a timed session counts down for everyone and closes itself at the end', async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const api = mentor.context.request;
  const examId = await importExam(api, resolve('e2e/fixtures/timed-exam.md'));

  // Create form: picking the exam preselects "Giới hạn" with the file's minutes.
  await mentor.page.goto(`/admin/sessions?examId=${examId}`);
  await expect(mentor.page.getByLabel('Số phút')).toHaveValue('1');
  await expect(mentor.page.getByText('(theo file đề)')).toBeVisible();
  await mentor.page.screenshot({ path: shotPath('S25', '1-create-form-default'), fullPage: true });
  await mentor.page.getByRole('button', { name: 'Tạo phiên', exact: true }).last().click();
  await mentor.page.waitForURL(/\/admin\/sessions\/\d+$/);
  const id = Number(mentor.page.url().split('/').pop());
  await mentor.page.getByRole('button', { name: 'Mở phòng chờ' }).click();
  await expect(mentor.page.getByText('Thời gian làm bài').first()).toBeVisible();
  const roomCode = ((await (await api.get(`/api/admin/sessions/${id}`)).json()) as { roomCode: string }).roomCode;

  // A member on a phone waits in the lobby and sees the minutes.
  const member = await memberContext(browser, baseURL!, PHONE);
  await member.page.goto(`/?room=${roomCode}`);
  await member.page.getByLabel('Tên của bạn').fill('An');
  await member.page.getByRole('button', { name: 'Vào phòng' }).click();
  await mentor.page.getByRole('button', { name: 'Duyệt', exact: true }).first().click({ timeout: 15_000 });
  await expect(member.page.getByText('1 phút')).toBeVisible({ timeout: 10_000 });
  await member.page.screenshot({ path: shotPath('S25', '2-member-lobby-minutes'), fullPage: true });

  // Start: the member, the mentor and the projector all count down from the same deadline.
  // "Bắt đầu ngay" counts down 10 seconds, then the member is on question 1 (PRODUCT.md §7.31c, f).
  await mentor.page.getByRole('button', { name: 'Bắt đầu ngay' }).first().click();
  await mentor.page.getByRole('dialog').getByRole('button', { name: 'Bắt đầu ngay' }).click();
  await expect(member.page.getByRole('radio').first()).toBeVisible({ timeout: 20_000 });
  await expect(member.page.getByRole('timer')).toBeVisible();
  await member.page.getByRole('radio').first().click();
  await member.page.screenshot({ path: shotPath('S25', '3-member-taking-countdown'), fullPage: false });
  await expect(mentor.page.getByRole('timer').first()).toBeVisible();
  await mentor.page.screenshot({ path: shotPath('S25', '4-mentor-running-countdown'), fullPage: true });
  const screen = await mentor.context.newPage();
  await screen.setViewportSize({ width: 1920, height: 1080 });
  await screen.goto(`/screen/${id}`);
  await expect(screen.getByText('Còn lại')).toBeVisible();
  await screen.screenshot({ path: shotPath('S25', '5-projector-clock') });

  // 00:00: the member is told, then the session closes itself and the result says why.
  await expect(member.page.getByRole('heading', { name: 'Đã hết giờ' })).toBeVisible({ timeout: 70_000 });
  await member.page.screenshot({ path: shotPath('S25', '6-member-time-up') });
  // (the clock's screen-reader reminder says the same words, so wait for the result screen's own line)
  await expect(member.page.getByRole('status').filter({ hasText: 'nộp tự động' })).toContainText('Đã hết giờ làm bài.', { timeout: 20_000 });
  await member.page.screenshot({ path: shotPath('S25', '7-member-result-after-time-up'), fullPage: true });
  const detail = (await (await api.get(`/api/admin/sessions/${id}`)).json()) as { status: string; participants: { progress: { state: string } }[] };
  expect(['closed', 'finalized']).toContain(detail.status);
  expect(detail.participants[0]!.progress.state).toBe('submitted');
  await screen.close();
});
