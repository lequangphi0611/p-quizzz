import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { DESKTOP, PHONE, importExam, makeSession, memberContext, mentorContext, shotPath } from './helpers';

// S29 (PRODUCT.md §7.31) — start by hand ("Bắt đầu ngay" counts down 10 seconds), at a scheduled time, or once everyone
// is ready, whichever comes first. Rules are in the lobby; when the session starts, members go straight to question 1.
const join = async (page: import('@playwright/test').Page, room: string, name: string) => {
  await page.goto(`/?room=${room}`);
  await page.getByLabel('Tên của bạn').fill(name);
  await page.getByRole('button', { name: 'Vào phòng' }).click();
};

test('a scheduled start: the lobby counts down to the time, then everyone is on question 1', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const api = mentor.context.request;
  const examId = await importExam(api, resolve('e2e/fixtures/timed-exam.md'));
  const { id, roomCode } = await makeSession(api, examId);
  const desk = await memberContext(browser, baseURL!, DESKTOP);
  const phone = await memberContext(browser, baseURL!, PHONE);
  await join(desk.page, roomCode, 'An');
  await join(phone.page, roomCode, 'Bình');
  await expect(desk.page.getByText('Chờ mentor bắt đầu')).toBeVisible();
  await expect(desk.page.getByRole('heading', { name: 'Luật làm bài' }).or(desk.page.getByText('Luật làm bài'))).toBeVisible();

  // The mentor schedules the start 25 s from now and turns "everyone ready" on.
  await mentor.page.goto(`/admin/sessions/${id}`);
  expect((await api.put(`/api/admin/sessions/${id}/start-schedule`, { data: { startsAt: Date.now() + 25_000 } })).ok()).toBeTruthy();
  await expect(desk.page.getByText('Mentor đã hẹn bắt đầu lúc')).toBeVisible({ timeout: 10_000 });
  await expect(desk.page.getByRole('timer', { name: /Bắt đầu lúc/ })).toBeVisible();
  await desk.page.getByRole('button', { name: 'Sẵn sàng', exact: true }).click();
  await expect(desk.page.getByText('Bạn đã sẵn sàng')).toBeVisible();
  await desk.page.screenshot({ path: shotPath('S29', '1-member-desktop-scheduled-ready'), fullPage: true });
  await phone.page.screenshot({ path: shotPath('S29', '2-member-phone-scheduled'), fullPage: true });
  await mentor.page.reload();
  await expect(mentor.page.getByRole('region', { name: 'Bắt đầu' })).toBeVisible();
  await mentor.page.screenshot({ path: shotPath('S29', '3-mentor-start-card'), fullPage: true });

  const screen = await mentor.context.newPage();
  await screen.setViewportSize({ width: 1920, height: 1080 });
  await screen.goto(`/screen/${id}`);
  await expect(screen.getByRole('timer', { name: /Bắt đầu lúc/ })).toBeVisible();
  await screen.screenshot({ path: shotPath('S29', '4-projector-lobby-scheduled') });

  // At the time the session starts by itself; nobody presses "Bắt đầu làm bài".
  for (const p of [desk.page, phone.page]) await expect(p.getByRole('radio').first()).toBeVisible({ timeout: 40_000 });
  await desk.page.screenshot({ path: shotPath('S29', '5-member-question-1'), fullPage: false });
  expect(((await (await api.get(`/api/admin/sessions/${id}`)).json()) as { status: string }).status).toBe('running');
});

test('"Bắt đầu ngay" counts down 10 s on members and the projector; a late arrival sees the time left', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const api = mentor.context.request;
  const examId = await importExam(api, resolve('e2e/fixtures/timed-exam.md'));
  const { id, roomCode } = await makeSession(api, examId);
  const member = await memberContext(browser, baseURL!, PHONE);
  await join(member.page, roomCode, 'An');
  await expect(member.page.getByText('Chờ mentor bắt đầu')).toBeVisible();

  await mentor.page.goto(`/admin/sessions/${id}`);
  const screen = await mentor.context.newPage();
  await screen.setViewportSize({ width: 1920, height: 1080 });
  await screen.goto(`/screen/${id}`);
  await mentor.page.bringToFront();
  await mentor.page.getByRole('button', { name: 'Bắt đầu ngay' }).first().click();
  await mentor.page.getByRole('dialog').getByRole('button', { name: 'Bắt đầu ngay' }).click();

  await expect(member.page.getByText('Bắt đầu sau', { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(member.page.getByText('Đang đếm ngược — không đổi sẵn sàng được nữa')).toBeVisible();
  await member.page.screenshot({ path: shotPath('S29', '6-member-phone-countdown'), fullPage: true });
  await expect(screen.getByRole('region', { name: 'Đếm ngược bắt đầu' })).toBeVisible({ timeout: 5_000 });
  await screen.screenshot({ path: shotPath('S29', '7-projector-countdown') });
  await expect(mentor.page.getByRole('button', { name: /Huỷ \(còn/ })).toBeVisible();
  await mentor.page.screenshot({ path: shotPath('S29', '8-mentor-countdown'), fullPage: true });

  await expect(member.page.getByRole('radio').first()).toBeVisible({ timeout: 20_000 });

  // Someone who arrives after the start is told how much time is left before question 1.
  const late = await memberContext(browser, baseURL!, DESKTOP);
  await late.page.goto(`/?room=${roomCode}`);
  await late.page.getByLabel('Tên của bạn').fill('Chi');
  await late.page.getByRole('button', { name: /Vào phòng|Xin vào phiên/ }).click();
  await expect(late.page.getByRole('heading', { name: 'Phiên đã bắt đầu, bạn còn' })).toBeVisible({ timeout: 15_000 });
  await late.page.screenshot({ path: shotPath('S29', '9-member-late'), fullPage: true });
  await late.page.getByRole('button', { name: 'Vào làm bài' }).click();
  await expect(late.page.getByRole('radio').first()).toBeVisible();
});
