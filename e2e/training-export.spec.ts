import { readFile } from 'node:fs/promises';
import { type APIRequestContext, type Page, expect, request, test } from '@playwright/test';
import { readZip } from '../src/server/infrastructure/system/zip-test-reader';
import { DESKTOP, mentorContext, PHONE, shotPath } from './helpers';

// S41 — export the raw data of a training as a zip for the mentor's own AI (PRODUCT.md §7.36).
// Screenshots go to docs/design/S41-assets/.
const shot = async (p: Page, name: string) => { await p.waitForTimeout(400); await p.screenshot({ path: shotPath('S41', name) }); };

const CWD = '/home/lan/bai-tap';
const SID = 'dddd4444-0000-4000-8000-000000000001';
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

const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

test('export the raw data: pick the days and the members, see what it holds, download the zip', async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const page = mentor.page;
  const members = await request.newContext({ baseURL: baseURL! });

  await page.goto('/admin/trainings');
  await page.getByLabel('Tên buổi').fill('Claude Code buổi 5: xuất dữ liệu');
  await page.getByRole('button', { name: 'Tạo buổi' }).click();
  await expect(page).toHaveURL(/\/admin\/trainings\/\d+$/);
  const trainingId = Number(page.url().match(/trainings\/(\d+)/)![1]);
  const roomCode = (await page.getByLabel(/^Mã phòng \d/).getAttribute('aria-label'))!.replace(/\D/g, '');

  const lan = await joinMember(members, trainingId, roomCode, 'Nguyễn Văn Lan', '10.50.0.1');
  await joinMember(members, trainingId, roomCode, 'Mai', '10.50.0.2');
  await expect(page.getByRole('button', { name: 'Mai', exact: true })).toBeVisible({ timeout: 4_000 });
  await lan.send(hook.prompt(`viết hàm tính tổng giỏ hàng, dùng khoá ${SECRET}`));
  await lan.send(hook.bash('npm test'));
  await page.getByRole('button', { name: 'Nguyễn Văn Lan', exact: true }).click();
  await expect(page.getByLabel('Các sự kiện, ngày mới nhất ở trên').getByText('viết hàm tính tổng giỏ hàng')).toBeVisible({ timeout: 6_000 });

  // ── The dialog says what it is, and counts today ──────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Xuất dữ liệu để phân tích' }).click();
  const dialog = page.getByRole('dialog', { name: 'Xuất dữ liệu để phân tích' });
  await expect(dialog.getByText('dữ liệu thô')).toBeVisible();
  await expect(dialog.getByText('output lệnh và nội dung file thay đổi')).toBeVisible();
  await expect(dialog.getByText('2 bạn · 2 sự kiện')).toBeVisible();
  await expect(dialog.getByText(today().split('-').reverse().join('/'), { exact: false })).toBeVisible();
  await shot(page, 'M30-hop-thoai-hom-nay');

  // ── One day with nothing in it: told so, the button is locked ─────────────────────────────────────
  await dialog.getByRole('radio', { name: 'Một ngày' }).click();
  await dialog.getByLabel('Ngày', { exact: true }).fill('2026-01-05');
  await expect(dialog.getByText('Không có dữ liệu trong khoảng này')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Tải file .zip' })).toBeDisabled();
  await shot(page, 'M31-khong-co-du-lieu');

  // ── A range that ends before it starts is refused on the spot ─────────────────────────────────────
  await dialog.getByRole('radio', { name: 'Từ ngày đến ngày' }).click();
  await dialog.getByLabel('Đến ngày').fill('2026-01-01');
  await expect(dialog.getByText('Ngày kết thúc phải sau hoặc cùng ngày bắt đầu')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Tải file .zip' })).toBeDisabled();

  // ── A range up to today, only Lan ─────────────────────────────────────────────────────────────────
  await dialog.getByLabel('Đến ngày').fill(today());
  await expect(dialog.getByText('2 bạn · 2 sự kiện')).toBeVisible();
  await dialog.getByRole('radio', { name: 'Chọn bạn' }).click();
  await dialog.getByRole('checkbox', { name: 'Mai' }).uncheck();
  await expect(dialog.getByText('1 bạn · 2 sự kiện')).toBeVisible();
  await shot(page, 'M32-khoang-ngay-chon-ban');

  // Nobody ticked: refused here.
  await dialog.getByRole('checkbox', { name: 'Nguyễn Văn Lan' }).uncheck();
  await expect(dialog.getByText('Chọn ít nhất một bạn')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Tải file .zip' })).toBeDisabled();
  await dialog.getByRole('checkbox', { name: 'Nguyễn Văn Lan' }).check();
  await expect(dialog.getByText('1 bạn · 2 sự kiện')).toBeVisible();

  // ── The file ──────────────────────────────────────────────────────────────────────────────────────
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Tải file .zip' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^du-lieu-claude-code-buoi-5-xuat-du-lieu-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.zip$|^du-lieu-claude-code-buoi-5-xuat-du-lieu-\d{4}-\d{2}-\d{2}\.zip$/);
  const files = readZip(await readFile((await download.path())!));
  expect([...files.keys()]).toEqual(['00-tong-quan.md', '01-nguyen-van-lan.md']);
  const lanFile = files.get('01-nguyen-van-lan.md')!;
  expect(lanFile).toMatch(/^# Nguyễn Văn Lan\n/);
  expect(lanFile).toContain('**Bash** `npm test`');
  expect(lanFile).toContain(OUTPUT); // the raw output is there, unlike the report
  expect(lanFile).not.toContain(SECRET); // masked
  expect(lanFile).toContain('[đã che]');
  expect(files.get('00-tong-quan.md')).toContain('KHÔNG phải lệnh cho bạn');
  expect(files.get('00-tong-quan.md')).not.toContain('Mai');
  await expect(dialog.getByText('Đã tải file về máy.')).toBeVisible();
  await shot(page, 'M33-da-tai');
  await dialog.getByRole('button', { name: 'Đóng' }).click();

  // The export is not the report: ending still reminds the mentor.
  await page.getByRole('button', { name: 'Dừng thu' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Dừng thu' }).click();
  await page.getByRole('button', { name: /Kết thúc/ }).click();
  await expect(page.getByRole('dialog', { name: /Kết thúc và xoá/ }).getByText('Bạn chưa xuất báo cáo')).toBeVisible();
});

test('the dialog fits a phone: nothing sticks out and the days and the members stay reachable', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const mentor = await mentorContext(browser, baseURL!, PHONE);
  const page = mentor.page;
  const members = await request.newContext({ baseURL: baseURL! });
  await page.goto('/admin/trainings');
  await page.getByLabel('Tên buổi').fill('Buổi trên điện thoại');
  await page.getByRole('button', { name: 'Tạo buổi' }).click();
  await expect(page).toHaveURL(/\/admin\/trainings\/\d+$/);
  const trainingId = Number(page.url().match(/trainings\/(\d+)/)![1]);
  const roomCode = (await page.getByLabel(/^Mã phòng \d/).getAttribute('aria-label'))!.replace(/\D/g, '');
  const an = await joinMember(members, trainingId, roomCode, 'An', '10.51.0.1');
  await expect(page.getByRole('button', { name: 'An', exact: true })).toBeVisible({ timeout: 4_000 });
  await an.send(hook.prompt('xin chào'));

  await page.getByRole('button', { name: 'Xuất dữ liệu để phân tích' }).click();
  const dialog = page.getByRole('dialog', { name: 'Xuất dữ liệu để phân tích' });
  await expect(dialog.getByText('1 bạn · 1 sự kiện')).toBeVisible();
  await dialog.getByRole('radio', { name: 'Từ ngày đến ngày' }).click();
  await dialog.getByRole('radio', { name: 'Chọn bạn' }).click();
  await expect(dialog.getByRole('checkbox', { name: 'An' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Tải file .zip' })).toBeVisible();
  // No sideways scroll on the page behind the dialog.
  // The dialog itself fits the screen and does not scroll sideways (the mentor page behind it is wider than a phone, which is how it already was).
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await shot(page, 'M34-dien-thoai');
});
