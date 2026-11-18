import { resolve } from 'node:path';
import { expect, test, type Browser } from '@playwright/test';
import { importExam, makeSession, memberContext, mentorContext, shotPath } from './helpers';

// S28 (PRODUCT.md §7.30): "Cần bàn trước" puts the questions fewest people got right first, keeps exam numbers on the
// strip and in the header, keeps the question on screen when toggled, survives F5, and shows no rate before the reveal.
test('discussion: "Cần bàn trước" reorders the strip by correct rate, keeping exam numbers', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!, { width: 1920, height: 1080 });
  const api = mentor.context.request;
  const examId = await importExam(api, resolve('e2e/fixtures/priority-order.md'));
  const { id, roomCode } = await makeSession(api, examId, { extra: { shuffle: false } });

  // Option index picked per question (0 = correct). Câu 1: 2/2 right · Câu 2: 0/2 · Câu 3: 1/2.
  const join = async (b: Browser, name: string) => {
    const m = await memberContext(b, baseURL!);
    await m.page.goto(`/?room=${roomCode}`);
    await m.page.getByLabel('Tên của bạn').fill(name);
    await m.page.getByRole('button', { name: 'Vào phòng' }).click();
    await expect(m.page.getByText(name).first()).toBeVisible();
    return m.page;
  };
  const an = await join(browser, 'An');
  const binh = await join(browser, 'Bình');
  await api.post(`/api/admin/sessions/${id}/start`);
  for (const [page, picks] of [[an, [0, 1, 0]], [binh, [0, 1, 1]]] as const) {
    for (const [i, pick] of picks.entries()) {
      await page.getByRole('radio').nth(pick).click();
      await expect(page.getByRole('radio').nth(pick)).toHaveAttribute('aria-checked', 'true');
      if (i < picks.length - 1) await page.keyboard.press('ArrowRight');
    }
    await page.getByRole('button', { name: 'Nộp bài' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Nộp bài' }).click();
    await expect(page.getByText('Đã nộp').first()).toBeVisible();
  }
  await api.post(`/api/admin/sessions/${id}/close`);

  const page = mentor.page;
  const strip = page.getByRole('navigation', { name: 'Danh sách câu' });
  const labels = () => strip.getByRole('button').allTextContents();
  await page.goto(`/admin/sessions/${id}/discuss`);
  await expect(page.getByRole('heading', { name: /Câu dễ/ })).toBeVisible();
  expect(await labels()).toEqual(['1', '2', '3']);

  // Toggle: the strip regroups, the question on screen stays (Câu 1, now last).
  await page.getByRole('button', { name: /Cần bàn trước/ }).click();
  await expect.poll(labels).toEqual(['2', '3', '1']);
  await expect(page.getByRole('heading', { name: /Câu dễ/ })).toBeVisible();
  await expect(strip.getByRole('button', { name: 'Câu 1' })).toHaveAttribute('aria-current', 'step');

  // Navigation follows the new order; the header keeps the exam number.
  await strip.getByRole('button', { name: 'Câu 2' }).click();
  await expect(page.getByRole('heading', { name: /Câu bẫy/ })).toBeVisible();
  await expect(page.getByText('Câu 2', { exact: true })).toBeVisible();
  // Nothing new before the reveal: no correct count on screen yet.
  await expect(page.getByText('làm đúng')).toHaveCount(0);
  await page.screenshot({ path: shotPath('S28', 'priority-on') });
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: /Câu chia đôi/ })).toBeVisible();

  // F5 keeps both the order and the question.
  await page.reload();
  await expect(page.getByRole('heading', { name: /Câu chia đôi/ })).toBeVisible();
  expect(await labels()).toEqual(['2', '3', '1']);

  // S switches back to exam order, still on the same question.
  await page.keyboard.press('s');
  await expect.poll(labels).toEqual(['1', '2', '3']);
  await expect(page.getByRole('heading', { name: /Câu chia đôi/ })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('heading', { name: /Câu bẫy/ })).toBeVisible();
});
