import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { importExam, makeSession, memberContext, mentorContext, shotPath } from './helpers';

// Discussion mode, essay question with a long prompt and a code model answer (bugfix, S17 layout):
// the prompt and the rubric must stay above the papers and the key hints, and revealing the rubric widens it.
test('discussion: a long essay prompt and a code rubric never overlap the papers or the key hints', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!, { width: 1920, height: 1080 });
  const api = mentor.context.request;
  const examId = await importExam(api, resolve('e2e/fixtures/long-essay.md'));
  const { id, roomCode } = await makeSession(api, examId);

  // One member submits an empty paper, so the "bài bỏ trống" card shows under the question.
  const m = await memberContext(browser, baseURL!);
  await m.page.goto(`/?room=${roomCode}`);
  await m.page.getByLabel('Tên của bạn').fill('An');
  await m.page.getByRole('button', { name: 'Vào phòng' }).click();
  await expect(m.page.getByText('An').first()).toBeVisible();
  await api.post(`/api/admin/sessions/${id}/start`);
  await m.page.getByRole('button', { name: 'Nộp bài' }).first().click();
  await m.page.getByRole('dialog').getByRole('button', { name: 'Nộp bài' }).click();
  await expect(m.page.getByText('Đã nộp').first()).toBeVisible();
  await api.post(`/api/admin/sessions/${id}/close`);

  const page = mentor.page;
  await page.goto(`/admin/sessions/${id}/discuss`);
  await expect(page.getByRole('heading', { name: 'Câu trắc nghiệm mở đầu' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  const prompt = page.getByRole('heading', { name: 'Refactor code kiểu Java bằng scope functions' });
  await expect(prompt).toBeVisible();
  const papers = page.getByRole('list', { name: 'Bài tự luận ẩn danh' });
  await expect(papers).toContainText('bài bỏ trống');

  const box = async (l: ReturnType<typeof page.locator>) => (await l.boundingBox())!;
  const hintsTop = (await box(page.locator('kbd', { hasText: 'Space' }).last())).y;
  const papersTop = (await box(papers)).y;
  const column = prompt.locator('..');
  const col = await box(column);
  expect(col.y + col.height, 'question column ends above the papers').toBeLessThanOrEqual(papersTop);
  // The long prompt scrolls inside its column instead of spilling out, and wraps instead of being cut at the side.
  expect(await column.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  expect(await prompt.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

  await page.getByRole('button', { name: 'Hiện đáp án' }).first().click();
  const rubric = page.getByRole('region', { name: 'Đáp án mẫu và rubric' });
  await expect(rubric).toContainText('Rubric (8đ)');
  const r = await box(rubric);
  expect(r.y + r.height, 'rubric ends above the papers').toBeLessThanOrEqual(papersTop);
  expect(r.y + r.height, 'rubric ends above the key hints').toBeLessThanOrEqual(hintsTop);
  // Revealed rubric takes about two thirds of the row (was a fixed 720px), so an ~80-column model answer fits.
  expect(r.width).toBeGreaterThan(1100);
  expect(await prompt.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'prompt still wraps in the narrower column').toBe(true);
  const code = rubric.locator('pre code');
  expect(await code.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: shotPath('S17', 'essay-long-revealed') });
});
