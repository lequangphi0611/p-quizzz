import { expect, test } from '@playwright/test';
import { DESKTOP, PHONE, importExam, memberContext, mentorContext, shotPath } from './helpers';

// S23 — hold scores until the mentor publishes them (PRODUCT.md §7.25), and the submit time column for the mentor.
test('held scores: members and the projector see only who submitted; "Công bố điểm" shows them to everyone', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const api = mentor.context.request;
  const examId = await importExam(api);

  // ── Mentor creates the session with "Giữ tới khi công bố" ──────────────────────────────────────
  await mentor.page.goto('/admin/sessions');
  await mentor.page.getByRole('button', { name: 'Tạo phiên', exact: true }).click();
  const select = mentor.page.locator('select').first();
  await select.selectOption(String(examId));
  await mentor.page.getByRole('radio', { name: 'Giữ tới khi công bố' }).click();
  await expect(mentor.page.getByText('Học viên và màn chiếu chỉ thấy ai đã nộp')).toBeVisible();
  await mentor.page.screenshot({ path: shotPath('S23', '1-create-form') });
  await mentor.page.getByRole('button', { name: 'Tạo phiên', exact: true }).click();
  await mentor.page.waitForURL(/\/admin\/sessions\/\d+$/);
  const id = Number(mentor.page.url().split('/').pop());
  const card = mentor.page.locator('section', { hasText: 'Điểm và bảng xếp hạng' });
  await expect(card).toContainText('Đang giữ điểm');
  await mentor.page.getByRole('button', { name: 'Mở phòng chờ' }).click();
  const roomCode = ((await (await api.get(`/api/admin/sessions/${id}`)).json()) as { roomCode: string }).roomCode;

  // ── Two members join (desktop + phone); the mentor approves and starts ─────────────────────────
  const a = await memberContext(browser, baseURL!, DESKTOP);
  const b = await memberContext(browser, baseURL!, PHONE);
  for (const [m, name] of [[a, 'An'], [b, 'Bình']] as const) {
    await m.page.goto(`/?room=${roomCode}`);
    await m.page.getByLabel('Tên của bạn').fill(name);
    await m.page.getByRole('button', { name: 'Vào phòng' }).click();
  }
  const people = ((await (await api.get(`/api/admin/sessions/${id}`)).json()) as { participants: { id: number }[] }).participants;
  for (const p of people) await api.post(`/api/admin/participants/${p.id}/approve`);
  await api.post(`/api/admin/sessions/${id}/start`);

  // ── An submits: "Đã nộp bài", no score ────────────────────────────────────────────────────────
  await a.page.getByRole('button', { name: 'Nộp bài' }).first().click();
  await a.page.getByRole('dialog').getByRole('button', { name: 'Nộp bài' }).click();
  await expect(a.page.getByText('Điểm sẽ được công bố sau')).toBeVisible();
  await expect(a.page.getByText('Điểm chưa công bố')).toBeVisible(); // the board lists who submitted, without scores
  await expect(a.page.getByText('Điểm phần trắc nghiệm')).toHaveCount(0);
  await a.page.screenshot({ path: shotPath('S23', '2-member-held-desktop'), fullPage: true });

  // ── Projector: who submitted, no scores ───────────────────────────────────────────────────────
  const screen = await mentor.context.newPage();
  await screen.setViewportSize({ width: 1920, height: 1080 });
  await screen.goto(`/screen/${id}`);
  await expect(screen.getByText('Điểm chưa công bố')).toBeVisible();
  await expect(screen.getByText('An', { exact: true })).toBeVisible();
  await screen.screenshot({ path: shotPath('S23', '3-projector-held') });

  // ── Mentor: submit time column, switch locked, publish ────────────────────────────────────────
  await mentor.page.reload();
  await expect(mentor.page.getByRole('columnheader', { name: 'Nộp lúc' })).toBeVisible();
  await expect(card).toContainText('1 người đã nộp');
  await expect(card).toContainText('Đã có người nộp bài nên không đổi được nữa');
  await mentor.page.screenshot({ path: shotPath('S23', '4-mentor-held'), fullPage: true });
  await card.getByRole('button', { name: 'Công bố điểm' }).click();
  const dialog = mentor.page.getByRole('dialog');
  await expect(dialog).toContainText('Còn 1 người chưa nộp');
  await mentor.page.screenshot({ path: shotPath('S23', '5-mentor-release-confirm') });
  await dialog.getByRole('button', { name: 'Công bố điểm' }).click();
  await expect(card).toContainText('Đã công bố lúc');

  // ── Everyone sees scores at once ──────────────────────────────────────────────────────────────
  await expect(a.page.getByText('Điểm phần trắc nghiệm').or(a.page.getByText('Điểm bài làm'))).toBeVisible({ timeout: 10_000 });
  await expect(a.page.getByText('Điểm sẽ được công bố sau')).toHaveCount(0);
  await expect(screen.getByText('Điểm chưa công bố')).toHaveCount(0, { timeout: 10_000 });
  await a.page.screenshot({ path: shotPath('S23', '6-member-released-desktop'), fullPage: true });
  await screen.screenshot({ path: shotPath('S23', '7-projector-released') });
  await mentor.page.screenshot({ path: shotPath('S23', '8-mentor-released'), fullPage: true });
});
