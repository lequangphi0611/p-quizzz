import { expect, test } from '@playwright/test';
import { DESKTOP, importExam, makeSession, memberContext, mentorContext, shotPath } from './helpers';

// S24 — one invitation message for several open sessions (PRODUCT.md §7.26).
test('mentor copies one invitation for the open sessions; it opens the right room and never names the session', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const api = mentor.context.request;
  const examId = await importExam(api);
  const morning = await makeSession(api, examId, { extra: { name: 'Git – nhóm sáng' } });
  const afternoon = await makeSession(api, examId, { steps: ['open', 'start'], extra: { name: 'Git – nhóm chiều' } });

  await mentor.page.goto('/admin/sessions');
  await mentor.page.getByRole('button', { name: 'Gửi lời mời' }).click();
  const dialog = mentor.page.getByRole('dialog', { name: 'Gửi lời mời' });
  const text = dialog.getByLabel('Nội dung tin (sửa được)');
  await expect(text).toHaveValue(/2 bài thi đang mở/);
  await expect(text).toHaveValue(new RegExp(`room=${morning.roomCode}`));
  await expect(text).toHaveValue(new RegExp(`room=${afternoon.roomCode}`));
  await expect(text).not.toHaveValue(/nhóm sáng|nhóm chiều/);
  await expect(dialog.getByText('member nhìn tin sẽ không phân biệt được', { exact: false })).toBeVisible(); // same exam twice
  await mentor.page.screenshot({ path: shotPath('S24', '1-invite-two-sessions') });

  // Untick one: the message is for one group only, no warning.
  await dialog.getByLabel(/Git – nhóm chiều/).uncheck();
  await expect(text).toHaveValue(/^Bài thi đang mở:/);
  await expect(text).not.toHaveValue(new RegExp(`room=${afternoon.roomCode}`));
  await expect(dialog.getByText('member nhìn tin sẽ không phân biệt được', { exact: false })).toHaveCount(0);
  await mentor.page.screenshot({ path: shotPath('S24', '2-invite-one-session') });

  // The link in the message takes a member straight to the right room.
  const link = (await text.inputValue()).match(/http:\/\/\S+/)![0];
  const member = await memberContext(browser, baseURL!, DESKTOP);
  await member.page.goto(new URL(link).pathname + new URL(link).search);
  await expect(member.page.getByLabel('Tên của bạn')).toBeVisible();
});
