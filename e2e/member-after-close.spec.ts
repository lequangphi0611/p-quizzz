import { resolve } from 'node:path';
import { type Page, expect, test } from '@playwright/test';
import { DESKTOP, PHONE, importExam, memberContext, mentorContext } from './helpers';

// Walkthrough of what a member sees and can do once the mentor closes the session (PRODUCT.md §4.6, §7.6).
// Screenshots go to SHOT_DIR (default: test-results/, not committed). The time-limit close is covered by S25.
const OUT = process.env.SHOT_DIR ?? resolve('test-results/member-after-close');
const shot = async (p: Page, name: string, fullPage = true) => { await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/${name}.png`, fullPage }); };

async function join(page: Page, room: string, name: string) {
  await page.goto(`/?room=${room}`);
  await page.getByLabel('Tên của bạn').fill(name);
  await page.getByRole('button', { name: /Vào phòng|Xin vào phiên/ }).click();
}

/** Answers questions in order: options whose text matches `texts` (else the `pick`-th option), some text on the essay; `stopAfter` leaves the rest blank. */
async function answerAll(page: Page, phone: boolean, opts: { pick?: number; texts?: string[]; essay?: string; stopAfter?: number } = {}) {
  const total = 4;
  for (let i = 0; i < (opts.stopAfter ?? total); i++) {
    const box = page.getByLabel('Câu trả lời của bạn');
    if (await box.isVisible()) await box.fill(opts.essay ?? 'Merge giữ lịch sử, tạo merge commit. Rebase làm lịch sử thẳng. Rủi ro: rebase nhánh đã push.');
    else {
      const opt = page.getByRole('radio').or(page.getByRole('checkbox'));
      let hit = false;
      for (const t of opts.texts ?? []) { const o = opt.filter({ hasText: t }); if (await o.count()) { await o.first().click(); hit = true; } }
      if (!hit) await opt.nth(Math.min(opts.pick ?? 0, (await opt.count()) - 1)).click();
    }
    await page.waitForTimeout(400); // autosave
    const next = page.getByRole('button', { name: /^Câu sau/ });
    if (i < total - 1 && await next.isVisible() && await next.isEnabled()) await next.click();
  }
}

async function submit(page: Page) {
  await page.getByRole('button', { name: 'Nộp bài' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Nộp bài' }).click();
  await expect(page.getByRole('heading', { name: 'Đã nộp bài' })).toBeVisible();
}

test('member screens after the mentor closes the session', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const api = mentor.context.request;
  const examId = await importExam(api);
  const created = await api.post('/api/admin/sessions', { data: { examId, autoApprove: true } });
  const { id } = await created.json() as { id: number };
  await api.post(`/api/admin/sessions/${id}/open`);
  const room = ((await (await api.get(`/api/admin/sessions/${id}`)).json()) as { roomCode: string }).roomCode;

  const an = await memberContext(browser, baseURL!, DESKTOP);   // submits before the close
  const dung = await memberContext(browser, baseURL!, PHONE);   // submits before the close (phone)
  const binh = await memberContext(browser, baseURL!, PHONE);   // still working when the mentor closes
  const chi = await memberContext(browser, baseURL!, DESKTOP);  // joined late, never pressed "Vào làm bài"
  for (const [m, n] of [[an, 'An'], [dung, 'Dũng'], [binh, 'Bình']] as const) await join(m.page, room, n);
  await api.post(`/api/admin/sessions/${id}/start`); // whoever is in the room goes straight to question 1 (PRODUCT.md §7.31f)
  await join(chi.page, room, 'Chi');
  await expect(chi.page.getByRole('button', { name: 'Vào làm bài' })).toBeVisible({ timeout: 15_000 });
  await answerAll(an.page, false, { texts: ['checkout -b', 'cả hai mục', '--amend', 'rebase main'] });
  await submit(an.page);
  await answerAll(dung.page, true, { texts: ['checkout -b'], pick: 1 });
  await submit(dung.page);
  await answerAll(binh.page, true, { pick: 2, stopAfter: 2 });
  await shot(an.page, '00-an-desktop-submitted-before-close');

  // ── Mentor closes ──────────────────────────────────────────────────────────────────────────────
  expect((await api.post(`/api/admin/sessions/${id}/close`)).ok()).toBeTruthy();

  await expect(an.page.getByRole('heading', { name: 'Phiên đã kết thúc' })).toBeVisible({ timeout: 15_000 });
  await shot(an.page, '01-an-desktop-closed-result');
  await expect(dung.page.getByRole('heading', { name: 'Phiên đã kết thúc' })).toBeVisible({ timeout: 15_000 });
  await shot(dung.page, '02-dung-phone-closed-result');
  await shot(dung.page, '02b-dung-phone-closed-result-viewport', false);
  await expect(binh.page.getByText('nộp tự động')).toBeVisible({ timeout: 15_000 });
  await shot(binh.page, '03-binh-phone-auto-submitted');
  await expect(chi.page.getByText('Bạn chưa làm bài trong phiên này.')).toBeVisible({ timeout: 15_000 });
  await shot(chi.page, '04-chi-desktop-never-started');

  // ── Xem lại bài (CLOSED, essay not graded yet) ─────────────────────────────────────────────────
  await an.page.getByRole('button', { name: 'Xem lại bài' }).click();
  await expect(an.page.getByRole('heading', { name: 'Xem lại bài' })).toBeVisible();
  await shot(an.page, '05-an-desktop-review-closed', false);
  await an.page.getByRole('switch').or(an.page.getByText(/Chỉ câu chưa đúng/)).first().click();
  await shot(an.page, '06-an-desktop-review-only-wrong', false);
  await dung.page.getByRole('button', { name: 'Xem lại bài' }).click();
  await expect(dung.page.getByRole('heading', { name: 'Xem lại bài' })).toBeVisible();
  await shot(dung.page, '07-dung-phone-review-closed');
  await dung.page.getByRole('button', { name: 'Về trang kết quả' }).click();
  await expect(dung.page.getByRole('heading', { name: 'Phiên đã kết thúc' })).toBeVisible();
  await shot(dung.page, '08-dung-phone-back-to-result', false);
  await an.page.getByRole('button', { name: 'Về trang kết quả' }).click();
  await expect(an.page.getByRole('heading', { name: 'Phiên đã kết thúc' })).toBeVisible();

  // ── Mentor grades the essays and finalizes: the result page updates on its own ─────────────────
  const grading = await (await api.get(`/api/admin/sessions/${id}/grading`)).json() as { questions: { answers: { answerId: number; displayName: string }[] }[] };
  for (const q of grading.questions) for (const a of q.answers) {
    const score = a.displayName === 'An' ? 4 : a.displayName === 'Dũng' ? 2.5 : 0;
    await api.put(`/api/admin/answers/${a.answerId}/grade`, { data: { score, feedback: score ? 'Đúng bản chất merge/rebase, nêu thêm ví dụ rủi ro cụ thể.' : 'Chưa trả lời.' } });
  }
  expect((await api.post(`/api/admin/sessions/${id}/finalize`)).ok()).toBeTruthy();
  await expect(an.page.getByText('Đã chốt kết quả')).toBeVisible({ timeout: 15_000 });
  await shot(an.page, '09-an-desktop-finalized-result');
  await expect(dung.page.getByText('Đã chốt kết quả')).toBeVisible({ timeout: 15_000 });
  await shot(dung.page, '10-dung-phone-finalized-result');
  await an.page.getByRole('button', { name: 'Xem lại bài' }).click();
  await expect(an.page.getByRole('heading', { name: 'Xem lại bài' })).toBeVisible();
  await an.page.getByText('Đúng bản chất merge/rebase').first().scrollIntoViewIfNeeded().catch(() => {});
  await an.page.locator('main').evaluate(el => { el.scrollTop = el.scrollHeight; }).catch(() => {});
  await shot(an.page, '11-an-desktop-review-finalized-essay', false);
  await an.page.getByRole('button', { name: 'Về trang kết quả' }).click();

  // ── "Vào phòng khác" (PRODUCT.md §7.29): the result can be reopened from this browser ───────────
  await an.page.getByRole('button', { name: 'Vào phòng khác' }).click();
  const mine = an.page.getByRole('region', { name: 'Phiên của bạn trên máy này' });
  await expect(mine).toContainText('Ôn tập Git cơ bản');
  await expect(mine).toContainText('Đã chốt kết quả');
  await shot(an.page, '12-an-desktop-my-sessions-after-leaving');
  await an.page.reload();
  await expect(mine).toContainText('Ôn tập Git cơ bản');
  await mine.getByRole('button', { name: /^Ôn tập Git cơ bản/ }).click();
  await expect(an.page.getByRole('heading', { name: 'Phiên đã kết thúc' })).toBeVisible();
  await an.page.getByRole('button', { name: 'Xem lại bài' }).click();
  await expect(an.page.getByRole('heading', { name: 'Xem lại bài' })).toBeVisible();
  await an.page.getByRole('button', { name: 'Về trang kết quả' }).click();
  await expect(an.page.getByRole('heading', { name: 'Phiên đã kết thúc' })).toBeVisible();

  // The old link goes straight back to the result (no lookup, so no "wrong code").
  await an.page.goto(`/?room=${room}`);
  await expect(an.page.getByRole('heading', { name: 'Phiên đã kết thúc' })).toBeVisible();
  await shot(an.page, '13-an-desktop-old-link-back-to-result');

  // Phone: the list under the code form.
  await dung.page.getByRole('button', { name: 'Vào phòng khác' }).click();
  await expect(dung.page.getByRole('region', { name: 'Phiên của bạn trên máy này' })).toBeVisible();
  await shot(dung.page, '14-dung-phone-my-sessions');

  // Another browser that never joined: the old code reads like a wrong code (an ended session is not discoverable).
  const stranger = await memberContext(browser, baseURL!, DESKTOP);
  await stranger.page.goto(`/?room=${room}`);
  await expect(stranger.page.getByText('Không tìm thấy phòng đang mở với mã này. Kiểm tra lại mã, hoặc phiên đã kết thúc.')).toBeVisible();
  await expect(stranger.page.getByRole('region', { name: 'Phiên của bạn trên máy này' })).toHaveCount(0);
  await shot(stranger.page, '15-stranger-old-code-neutral');

  // "Xoá khỏi máy này": confirm, then this browser cannot reopen it.
  await an.page.getByRole('button', { name: 'Vào phòng khác' }).click();
  await mine.getByRole('button', { name: /khỏi máy này/ }).click();
  await shot(an.page, '16-an-desktop-forget-confirm', false);
  await an.page.getByRole('dialog').getByRole('button', { name: 'Xoá khỏi máy này' }).click();
  await expect(mine).toHaveCount(0);
  await an.page.goto(`/?room=${room}`);
  await expect(an.page.getByText('Không tìm thấy phòng đang mở với mã này.', { exact: false })).toBeVisible();
  await shot(an.page, '17-an-desktop-after-forget');
});
