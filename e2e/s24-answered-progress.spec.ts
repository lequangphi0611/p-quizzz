import { expect, test } from '@playwright/test';
import { DESKTOP, importExam, makeSession, memberContext, mentorContext, shotPath } from './helpers';

// S24 (PRODUCT.md §7.26) — the mentor's control page shows how many questions each member has answered, without reloading.
test('mentor sees "Đang làm · answered/total" update while a member works', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const api = mentor.context.request;
  const examId = await importExam(api);
  const { id, roomCode } = await makeSession(api, examId, { steps: ['open', 'start'], extra: { shuffle: false } }); // first question is single choice

  const member = await memberContext(browser, baseURL!, DESKTOP);
  await member.page.goto(`/?room=${roomCode}`);
  await member.page.getByLabel('Tên của bạn').fill('An');
  await member.page.getByRole('button', { name: 'Xin vào phiên' }).click(); // the session is already running
  await member.page.getByRole('button', { name: 'Bắt đầu làm bài' }).click();

  await mentor.page.goto(`/admin/sessions/${id}`);
  const total = ((await (await api.get(`/api/admin/sessions/${id}`)).json()) as { participants: { progress: { questionCount: number } }[] }).participants[0]!.progress.questionCount;
  await expect(mentor.page.getByText(`Đang làm · 0/${total}`)).toBeVisible();

  // The member picks an option (any, right or wrong); saving sends no event, the page's periodic refresh picks it up.
  await member.page.getByRole('radio').first().click();
  await expect(member.page.getByRole('radio').first()).toHaveAttribute('aria-checked', 'true');
  await expect(mentor.page.getByText(`Đang làm · 1/${total}`)).toBeVisible({ timeout: 12_000 });
  await mentor.page.screenshot({ path: shotPath('S24', '1-mentor-answered-progress'), fullPage: true });
});
