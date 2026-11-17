import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { importExam, makeSession, mentorContext, shotPath } from './helpers';

// S25 (PRODUCT.md §7.17d) — each discussion question opens with only the question on screen. The class's work (B)
// and the answer (Space) are two separate covers; the class never sees a count before the mentor shows the work.

interface Q { id: number; type: string; options: { id: number; text: string }[] }

/** One member, fully through the API: join, start, answer by option text (or essay text), submit. */
async function member(api: APIRequestContext, sessionId: number, roomCode: string, name: string, n: number, picks: Record<number, string[] | string>) {
  const ip = { 'x-forwarded-for': `10.25.0.${n}` };
  const joined = await api.post(`/api/sessions/${sessionId}/join`, { data: { displayName: name, roomCode }, headers: ip });
  expect(joined.ok(), 'join').toBeTruthy();
  const headers = { ...ip, 'x-participant-token': ((await joined.json()) as { token: string }).token };
  const started = await api.post('/api/me/attempts', { headers });
  expect(started.ok(), 'start').toBeTruthy();
  const attempt = (await started.json()) as { id: number; questions: Q[] };
  for (const [i, pick] of Object.entries(picks)) {
    const q = attempt.questions[Number(i)]!;
    const data = typeof pick === 'string' ? { textAnswer: pick } : { selectedOptionIds: q.options.filter(o => pick.some(p => o.text.includes(p))).map(o => o.id) };
    expect((await api.put(`/api/me/attempts/${attempt.id}/answers/${q.id}`, { data, headers })).ok(), 'answer').toBeTruthy();
  }
  expect((await api.post(`/api/me/attempts/${attempt.id}/submit`, { headers })).ok(), 'submit').toBeTruthy();
}

const chip = (page: Page, label: string) => page.getByRole('status', { name: new RegExp(`^${label}:`) });

test('discussion: question first, class work and answer revealed separately', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!, { width: 1920, height: 1080 });
  const api = mentor.context.request;
  const examId = await importExam(api); // Git cơ bản: 3 choice questions, then 1 essay
  const { id, roomCode } = await makeSession(api, examId, { steps: ['open', 'start'], extra: { shuffle: false } });
  const essay = 'Merge giữ nguyên lịch sử, rebase viết lại commit cho thẳng. Rủi ro: rebase branch đã push.';
  await member(api, id, roomCode, 'An', 1, { 0: ['checkout -b'], 1: ['--amend', 'rebase main'], 3: essay });
  await member(api, id, roomCode, 'Bình', 2, { 0: ['checkout -b'], 1: ['--amend'], 3: 'merge gộp nhánh, rebase thì viết lại' });
  await member(api, id, roomCode, 'Chi', 3, { 0: ['git branch'], 1: ['--amend', 'rebase main'], 3: '' });
  await member(api, id, roomCode, 'Dũng', 4, { 0: ['git branch'], 3: 'Dùng rebase khi muốn lịch sử gọn.' });
  await member(api, id, roomCode, 'Em', 5, { 0: ['checkout -b'] });
  expect((await api.post(`/api/admin/sessions/${id}/close`)).ok()).toBeTruthy();

  const page = mentor.page;
  await page.goto(`/admin/sessions/${id}/discuss`);
  const options = page.getByRole('list', { name: 'Các phương án' });
  await expect(options.getByRole('listitem')).toHaveCount(4);

  // 1. Nothing open: plain options, no count or percentage anywhere, only papers and blanks.
  await expect(chip(page, 'Bài làm')).toHaveAccessibleName('Bài làm: đang ẩn');
  await expect(chip(page, 'Đáp án')).toHaveAccessibleName('Đáp án: đang ẩn');
  await expect(page.getByText(/\d+%/)).toHaveCount(0);
  await expect(page.getByText('người', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Nhầm phổ biến')).toHaveCount(0);
  await expect(page.getByText('làm đúng')).toHaveCount(0);
  await expect(page.getByText('Đáp án và giải thích đang ẩn')).toBeVisible();
  await page.screenshot({ path: shotPath('S25', '1-choice-nothing-open') });

  // 3. Answer only (Space): correct option marked + explanation, still nothing about how the class picked.
  await page.keyboard.press('Space');
  await expect(chip(page, 'Đáp án')).toHaveAccessibleName('Đáp án: đã hiện');
  await expect(page.getByText('Đáp án đúng')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Giải thích' })).toBeVisible();
  await expect(page.getByText(/\d+%/)).toHaveCount(0);
  await expect(page.getByText('làm đúng')).toHaveCount(0);
  await page.screenshot({ path: shotPath('S25', '3-choice-answer-only') });

  // 4. Both (B): tallies, common mistake, "x/y làm đúng".
  await page.keyboard.press('b');
  await expect(chip(page, 'Bài làm')).toHaveAccessibleName('Bài làm: đã hiện');
  const tally = page.getByRole('list', { name: 'Lựa chọn của cả lớp' });
  await expect(tally.getByRole('listitem', { name: /Phương án B: 3 người, 60%, đáp án đúng/ })).toBeVisible();
  await expect(page.getByText('Nhầm phổ biến')).toBeVisible();
  await expect(page.getByText('làm đúng')).toBeVisible();
  await page.waitForTimeout(800); // bars finish growing
  await page.screenshot({ path: shotPath('S25', '4-choice-both-open') });

  // 2. Work only: neutral tallies, no answer, no common-mistake flag.
  await page.getByRole('button', { name: /Ẩn đáp án/ }).click();
  await expect(chip(page, 'Đáp án')).toHaveAccessibleName('Đáp án: đang ẩn');
  await expect(tally.getByRole('listitem', { name: 'Phương án B: 3 người, 60%' })).toBeVisible();
  await expect(page.getByText('Nhầm phổ biến')).toHaveCount(0);
  await expect(page.getByText('làm đúng')).toHaveCount(0);
  await page.waitForTimeout(800);
  await page.screenshot({ path: shotPath('S25', '2-choice-work-only') });

  // 5. A new question opens with nothing shown; the strip marks question 1 as discussed; coming back keeps its state.
  await page.keyboard.press('ArrowRight');
  await expect(chip(page, 'Bài làm')).toHaveAccessibleName('Bài làm: đang ẩn');
  await expect(page.getByText('Chọn nhiều đáp án — có thể có hơn một phương án đúng')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Câu 1, đã mở bài làm' })).toBeVisible();
  await page.screenshot({ path: shotPath('S25', '5-multi-nothing-open') });
  await page.keyboard.press('ArrowLeft');
  await expect(chip(page, 'Bài làm')).toHaveAccessibleName('Bài làm: đã hiện');

  // 6. Essay, work hidden: no papers, J does not open one, grading progress still shows.
  await page.getByRole('button', { name: /^Câu 4/ }).click();
  await expect(page.getByText('Bài làm của lớp đang ẩn')).toBeVisible();
  await expect(page.getByText('hiện bài làm để chấm')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Bài tự luận ẩn danh' })).toHaveCount(0);
  await page.keyboard.press('j');
  await expect(page.getByRole('button', { name: 'Danh sách bài' })).toHaveCount(0);
  await page.screenshot({ path: shotPath('S25', '6-essay-nothing-open') });

  // 8. Essay, answer only: rubric shown, papers still hidden.
  await page.keyboard.press('Space');
  await expect(page.getByRole('region', { name: 'Đáp án mẫu và rubric' })).toBeVisible();
  await expect(page.getByText('Bài làm của lớp đang ẩn')).toBeVisible();
  await page.screenshot({ path: shotPath('S25', '8-essay-answer-only') });
  await page.keyboard.press('Space');

  // 7. Essay, work shown: anonymous papers; J opens one; hiding the work from a paper goes back to the hidden panel.
  await page.keyboard.press('b');
  const papers = page.getByRole('list', { name: 'Bài tự luận ẩn danh' });
  await expect(papers).toContainText('bài bỏ trống');
  await page.waitForTimeout(800);
  await page.screenshot({ path: shotPath('S25', '7-essay-work-open') });
  await page.keyboard.press('j');
  await expect(page.getByRole('button', { name: 'Danh sách bài' })).toBeVisible();
  await page.keyboard.press('b');
  await expect(page.getByText('Bài làm của lớp đang ẩn')).toBeVisible();

  // Reloading forgets what was opened.
  await page.reload();
  await expect(page.getByText('Bài làm của lớp đang ẩn')).toBeVisible();
  await expect(chip(page, 'Đáp án')).toHaveAccessibleName('Đáp án: đang ẩn');

  // Laptop size: the same states still fit.
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(500); // let the reload fade-in finish
  await page.screenshot({ path: shotPath('S25', '6L-essay-nothing-open-1366') });
  await page.getByRole('button', { name: /^Câu 1/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: shotPath('S25', '1L-choice-nothing-open-1366') });
});
