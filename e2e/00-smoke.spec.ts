import { expect, test } from '@playwright/test';
import { importExam, makeSession, memberContext, mentorContext } from './helpers';

// Baseline: the current single-session flow works end to end (mentor → open room → member joins by code).
test('mentor opens a room and a member joins with the room code', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!);
  const examId = await importExam(mentor.context.request);
  const session = await makeSession(mentor.context.request, examId);
  expect(session.roomCode).toMatch(/^\d{6}$/);

  const member = await memberContext(browser, baseURL!);
  await member.page.goto(`/?room=${session.roomCode}`);
  await member.page.getByLabel(/tên/i).first().fill('An');
  await member.page.getByRole('button', { name: /vào/i }).first().click();
  await expect(member.page.getByText('An').first()).toBeVisible();
});
