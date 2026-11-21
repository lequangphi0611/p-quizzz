import { readFile } from 'node:fs/promises';
import { type APIRequestContext, type Page, expect, request, test } from '@playwright/test';
import { DESKTOP, mentorContext, shotPath } from './helpers';

// S40 — marking examples, a note per member, the report preview and file, the prompt before "Kết thúc" (PRODUCT.md §7.35e).
// Screenshots go to docs/design/S40-assets/.
const shot = async (p: Page, name: string) => { await p.waitForTimeout(400); await p.screenshot({ path: shotPath('S40', name) }); };

const CWD = '/home/lan/bai-tap';
const SID = 'cccc3333-0000-4000-8000-000000000001';
const base = { session_id: SID, transcript_path: '/home/lan/.claude/projects/x/t.jsonl', cwd: CWD, permission_mode: 'default', prompt_id: 'p-1' };
const SECRET = 'sk-abcdefghijklmnopqrstuvwxyz123456';
const OUTPUT = 'PASS cart.test.ts tổng giỏ hàng đúng';

const hook = {
  prompt: (text: string) => ({ ...base, hook_event_name: 'UserPromptSubmit', prompt: text }),
  bash: (command: string, stdout = OUTPUT) => ({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command }, tool_response: { stdout, stderr: '', interrupted: false }, duration_ms: 300 }),
};

async function joinMember(api: APIRequestContext, trainingId: number, roomCode: string, name: string, ip: string) {
  const joined = await api.post(`/api/trainings/${trainingId}/join`, { data: { displayName: name, roomCode, consent: true }, headers: { 'x-forwarded-for': ip } });
  expect(joined.ok(), `join ${name}`).toBeTruthy();
  const { token } = await joined.json() as { token: string };
  const cfg = await api.get('/api/training/me/hook-config', { headers: { 'x-training-member-token': token } });
  const { settings } = await cfg.json() as { settings: { hooks: { PostToolUse: { hooks: { headers: Record<string, string> }[] }[] } } };
  const ingestToken = settings.hooks.PostToolUse[0]!.hooks[0]!.headers['X-Training-Token']!;
  return { send: async (payload: unknown) => (await api.post('/api/training/ingest', { data: payload, headers: { 'X-Training-Token': ingestToken } })).status() };
}

test('mark examples, write a note, preview and download the report, and the prompt before ending', async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const page = mentor.page;
  const members = await request.newContext({ baseURL: baseURL! });

  await page.goto('/admin/trainings');
  await page.getByLabel('Tên buổi').fill('Claude Code buổi 4: báo cáo');
  await page.getByRole('button', { name: 'Tạo buổi' }).click();
  await expect(page).toHaveURL(/\/admin\/trainings\/\d+$/);
  const trainingId = Number(page.url().match(/trainings\/(\d+)/)![1]);
  const roomCode = (await page.getByLabel(/^Mã phòng \d/).getAttribute('aria-label'))!.replace(/\D/g, '');

  const lan = await joinMember(members, trainingId, roomCode, 'Lan', '10.40.0.1');
  await joinMember(members, trainingId, roomCode, 'Mai', '10.40.0.2');
  await expect(page.getByRole('button', { name: 'Mai', exact: true })).toBeVisible({ timeout: 4_000 });
  await lan.send(hook.prompt(`viết hàm tính tổng giỏ hàng, dùng khoá ${SECRET}`));
  await lan.send(hook.bash('npm test'));
  await lan.send(hook.prompt('chạy lại giúp mình'));

  // ── Report with nothing marked: it says so ─────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Lan', exact: true }).click();
  const timeline = page.getByLabel('Các sự kiện, cũ ở trên, mới ở dưới');
  await expect(timeline.getByText('chạy lại giúp mình')).toBeVisible({ timeout: 6_000 });
  await page.getByRole('button', { name: 'Xuất báo cáo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Xuất báo cáo' });
  await expect(dialog.getByText('Bạn chưa đánh dấu ví dụ nào')).toBeVisible();
  await expect(dialog.getByLabel('Xem trước báo cáo')).toContainText('### Lan');
  await expect(dialog.getByLabel('Xem trước báo cáo')).not.toContainText('npm test');
  await dialog.getByRole('button', { name: 'Đóng' }).click();

  // ── Mark the first prompt and the command; write a note ────────────────────────────────────────────
  const markButtons = timeline.getByRole('button', { name: 'Đánh dấu làm ví dụ cho báo cáo' });
  await markButtons.first().click();
  await expect(timeline.getByRole('button', { name: 'Bỏ đánh dấu ví dụ' })).toHaveCount(1);
  await timeline.locator('li', { hasText: 'npm test' }).getByRole('button', { name: 'Đánh dấu làm ví dụ cho báo cáo' }).click();
  await expect(timeline.getByRole('button', { name: 'Bỏ đánh dấu ví dụ' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
  await page.getByLabel('Ghi chú về Lan').fill('Nhắc Lan chạy test sau mỗi lần sửa. Đã lộ TOKEN=abcdefgh12345678.');
  await page.getByRole('button', { name: 'Lưu ghi chú' }).click();
  await expect(page.getByText('Đã lưu.')).toBeVisible();
  await shot(page, 'M24-danh-dau-va-ghi-chu');

  // The marks and the note survive a reload.
  await page.reload();
  await page.getByRole('button', { name: 'Lan', exact: true }).click();
  await expect(timeline.getByRole('button', { name: 'Bỏ đánh dấu ví dụ' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Ghi chú ✓' })).toBeVisible();

  // ── Preview, then the file ─────────────────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Xuất báo cáo' }).click();
  await expect(dialog.getByText('Đã đánh dấu 2 ví dụ · 1 ghi chú')).toBeVisible();
  const preview = dialog.getByLabel('Xem trước báo cáo');
  await expect(preview).toContainText('### Lan');
  await expect(preview).toContainText('### Mai');
  await expect(preview).toContainText('Bash `npm test` · chạy được');
  await expect(preview).toContainText('Nhắc Lan chạy test');
  await expect(preview).toContainText('[đã che]');
  await shot(page, 'M25-hop-thoai-xuat');

  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Tải file .md' }).click()]);
  expect(download.suggestedFilename()).toBe('bao-cao-claude-code-buoi-4-bao-cao.md');
  const file = await readFile((await download.path())!, 'utf8');
  expect(file).toContain('# Báo cáo buổi training: Claude Code buổi 4: báo cáo');
  expect(file).toContain('### Lan');
  expect(file).toContain('Nhắc Lan chạy test sau mỗi lần sửa');
  // Neither the output nor a secret is in the file.
  expect(file).not.toContain(OUTPUT);
  expect(file).not.toContain(SECRET);
  expect(file).not.toContain('abcdefgh12345678');
  await expect(dialog.getByText('Đã tải file về máy.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng' }).click();

  // ── "Kết thúc" after the export: no reminder ───────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Dừng thu' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Dừng thu' }).click();
  await expect(page.getByRole('button', { name: /Kết thúc/ })).toBeVisible({ timeout: 4_000 });
  await page.getByRole('button', { name: /Kết thúc/ }).click();
  await expect(page.getByRole('dialog').getByText('Bạn chưa xuất báo cáo')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Huỷ' }).click();
});

test('ending before any export reminds the mentor, and the reminder leads to the report', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const page = mentor.page;
  const members = await request.newContext({ baseURL: baseURL! });

  await page.goto('/admin/trainings');
  await page.getByLabel('Tên buổi').fill('Buổi chưa xuất');
  await page.getByRole('button', { name: 'Tạo buổi' }).click();
  await expect(page).toHaveURL(/\/admin\/trainings\/\d+$/);
  const trainingId = Number(page.url().match(/trainings\/(\d+)/)![1]);
  const roomCode = (await page.getByLabel(/^Mã phòng \d/).getAttribute('aria-label'))!.replace(/\D/g, '');
  const an = await joinMember(members, trainingId, roomCode, 'An', '10.41.0.1');
  await expect(page.getByRole('button', { name: 'An', exact: true })).toBeVisible({ timeout: 4_000 });
  await an.send(hook.prompt('xin chào'));

  await page.getByRole('button', { name: 'Dừng thu' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Dừng thu' }).click();
  await page.getByRole('button', { name: /Kết thúc/ }).click();
  const end = page.getByRole('dialog', { name: /Kết thúc và xoá/ });
  await expect(end.getByText('Bạn chưa xuất báo cáo')).toBeVisible();
  await shot(page, 'M26-nhac-khi-ket-thuc');

  await end.getByRole('button', { name: 'Xuất báo cáo trước' }).click();
  const report = page.getByRole('dialog', { name: 'Xuất báo cáo' });
  await expect(report.getByLabel('Xem trước báo cáo')).toContainText('### An');
  await Promise.all([page.waitForEvent('download'), report.getByRole('button', { name: 'Tải file .md' }).click()]);
  await report.getByRole('button', { name: 'Đóng' }).click();

  // After the download the reminder is gone, and ending still works and takes the marks away with everything else.
  await page.getByRole('button', { name: /Kết thúc/ }).click();
  const end2 = page.getByRole('dialog', { name: /Kết thúc và xoá/ });
  await expect(end2.getByText('Bạn chưa xuất báo cáo')).toHaveCount(0);
  await end2.getByRole('button', { name: 'Kết thúc và xoá' }).click();
  await expect(page.getByText('Buổi này đã kết thúc')).toBeVisible({ timeout: 4_000 });
  await expect(page.getByRole('button', { name: 'Xuất báo cáo' })).toHaveCount(0);
});
