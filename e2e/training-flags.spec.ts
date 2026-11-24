import { type APIRequestContext, type Page, expect, request, test } from '@playwright/test';
import { DESKTOP, mentorContext, shotPath } from './helpers';

// S39 — the new timeline rows, the behaviour flags and the class summary (PRODUCT.md §7.35). Members send hook JSON through the real
// API the way Claude Code would; the mentor works in the browser. Screenshots go to docs/design/S39-assets/.
const shot = async (p: Page, name: string, fullPage = false) => { await p.waitForTimeout(400); await p.screenshot({ path: shotPath('S39', name), fullPage }); };

const CWD = '/home/lan/bai-tap';
const SID = 'bbbb2222-0000-4000-8000-000000000001';
const base = (mode = 'default') => ({ session_id: SID, transcript_path: '/home/lan/.claude/projects/x/t.jsonl', cwd: CWD, permission_mode: mode, prompt_id: 'p-1' });
const quiet = { session_id: SID, transcript_path: '/home/lan/.claude/projects/x/t.jsonl', cwd: CWD, prompt_id: 'p-1' }; // SessionEnd / PreCompact / Notification carry no mode

const hook = {
  prompt: (text: string, mode?: string) => ({ ...base(mode), hook_event_name: 'UserPromptSubmit', prompt: text }),
  permission: (command: string) => ({ ...base(), hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command } }),
  bash: (command: string, stdout = 'ok', ms = 300) => ({ ...base(), hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command }, tool_response: { stdout, stderr: '', interrupted: false }, duration_ms: ms }),
  edit: (file: string, from: string, to: string) => ({ ...base(), hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: `${CWD}/${file}`, old_string: from, new_string: to }, tool_response: {}, duration_ms: 6 }),
  clear: () => ({ ...quiet, hook_event_name: 'SessionEnd', reason: 'clear' }),
  compact: (trigger: 'manual' | 'auto', text: string | null = null) => ({ ...quiet, hook_event_name: 'PreCompact', trigger, custom_instructions: text }),
  idle: () => ({ ...quiet, hook_event_name: 'Notification', notification_type: 'idle_prompt', message: 'x' }),
  model: () => ({ ...base(), hook_event_name: 'PostModelSwitch', from_model: 'claude-opus-4-5', to_model: 'claude-sonnet-4-5', source: 'command' }),
  question: () => {
    const questions = [{ question: 'Dùng thư viện nào?', header: 'Thư viện', multiSelect: false, options: [{ label: 'vitest', description: '' }, { label: 'jest', description: '' }] }];
    return { ...base(), hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion', tool_input: { questions, answers: { 'Dùng thư viện nào?': 'vitest' } }, tool_response: { questions, answers: { 'Dùng thư viện nào?': 'vitest' } }, duration_ms: 9000 };
  },
  plan: () => ({ ...base('plan'), hook_event_name: 'PostToolUse', tool_name: 'ExitPlanMode', tool_input: { plan: '# Kế hoạch\n1. Viết hàm add\n2. Chạy test' }, tool_response: { plan: '# Kế hoạch\n1. Viết hàm add\n2. Chạy test' }, duration_ms: 5000 }),
};

interface Joined { send: (payload: unknown) => Promise<number> }

async function joinMember(api: APIRequestContext, trainingId: number, roomCode: string, name: string, ip: string): Promise<Joined> {
  const joined = await api.post(`/api/trainings/${trainingId}/join`, { data: { displayName: name, roomCode, consent: true }, headers: { 'x-forwarded-for': ip } });
  expect(joined.ok(), `join ${name}`).toBeTruthy();
  const { token } = await joined.json() as { token: string };
  const cfg = await api.get('/api/training/me/hook-config', { headers: { 'x-training-member-token': token } });
  const { settings } = await cfg.json() as { settings: { hooks: { PostToolUse: { hooks: { headers: Record<string, string> }[] }[] } } };
  const ingestToken = settings.hooks.PostToolUse[0]!.hooks[0]!.headers['X-Training-Token']!;
  return { send: async payload => (await api.post('/api/training/ingest', { data: payload, headers: { 'X-Training-Token': ingestToken } })).status() };
}

test('flags, the new rows and the class summary; the auto-accept switch', async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const page = mentor.page;
  const members = await request.newContext({ baseURL: baseURL! });

  // ── The create form has the switch, off by default ────────────────────────────────────────────────
  await page.goto('/admin/trainings');
  const allow = page.getByRole('checkbox', { name: /Cho phép chế độ tự chấp nhận/ });
  await expect(allow).not.toBeChecked();
  await shot(page, 'M20-form-tao-buoi');
  await page.getByLabel('Tên buổi').fill('Claude Code buổi 3: cờ gợi ý');
  await page.getByRole('button', { name: 'Tạo buổi' }).click();
  await expect(page).toHaveURL(/\/admin\/trainings\/\d+$/);
  const trainingId = Number(page.url().match(/trainings\/(\d+)/)![1]);
  const roomCode = (await page.getByLabel(/^Mã phòng \d/).getAttribute('aria-label'))!.replace(/\D/g, '');

  const lan = await joinMember(members, trainingId, roomCode, 'Lan', '10.39.0.1');
  const mai = await joinMember(members, trainingId, roomCode, 'Mai', '10.39.0.2');
  await expect(page.getByRole('button', { name: 'Mai', exact: true })).toBeVisible({ timeout: 4_000 });

  // ── Mai works quietly: nothing up ──────────────────────────────────────────────────────────────────
  await mai.send(hook.prompt('giải thích hàm total'));
  await mai.send(hook.bash('git status'));

  // ── Lan: every row kind, and a flag or two ─────────────────────────────────────────────────────────
  await lan.send(hook.prompt('viết hàm tính tổng giỏ hàng', 'bypassPermissions'));
  await lan.send(hook.model());
  await lan.send(hook.permission('npm test'));
  await lan.send(hook.bash('npm test', 'PASS cart.test.ts'));
  await lan.send(hook.permission('ls src'));
  await lan.send(hook.bash('ls src'));
  await lan.send(hook.permission('cat package.json'));
  await lan.send(hook.bash('cat package.json'));
  await lan.send(hook.question());
  await lan.send(hook.plan());
  await lan.send(hook.edit('src/cart.test.ts', "it('tính tổng', () => {", "it.skip('tính tổng', () => {"));
  await lan.send(hook.permission('git push --force'));
  await lan.send(hook.prompt('thôi, bỏ đi. key của tôi là sk-abcdefghijklmnopqrstuvwxyz123456'));
  await lan.send(hook.compact('manual', 'giữ lại ý chính'));
  await lan.send(hook.idle());
  await lan.send(hook.compact('auto'));
  await lan.send(hook.compact('auto'));
  await lan.send(hook.clear());

  // The members table: flag chips next to Lan, none next to Mai; names stay sorted, no score.
  const lanRow = page.locator('table[aria-label="Học viên"] tbody tr', { hasText: 'Lan' });
  const maiRow = page.locator('table[aria-label="Học viên"] tbody tr', { hasText: 'Mai' });
  await expect(lanRow.getByText('Có thể lộ bí mật')).toBeVisible({ timeout: 6_000 });
  for (const label of ['Chế độ tự chấp nhận', 'Đụng vào test', 'Lệnh nguy hiểm', 'Hội thoại tự nén nhiều lần', 'Đồng ý quyền rất nhanh']) await expect(lanRow.getByText(label)).toBeVisible();
  await expect(maiRow.locator('[data-flag]')).toHaveCount(0);

  // The class summary: counts only, no names.
  const summary = page.getByRole('region', { name: 'Tổng hợp lớp' });
  await expect(summary.getByText('1/2 bạn').first()).toBeVisible();
  await expect(summary).not.toContainText('Lan');
  await expect(summary).not.toContainText('Mai');
  await shot(page, 'M21-bang-co-goi-y');

  // ── Lan's timeline: the list has the prompts; the commands and markers of each open in a popup ─────────────
  await page.getByRole('button', { name: 'Lan', exact: true }).click();
  const timeline = page.getByLabel('Các sự kiện, ngày mới nhất ở trên');
  await expect(timeline.getByText('thôi, bỏ đi')).toBeVisible({ timeout: 6_000 });
  await expect(timeline.getByText('Bỏ qua hỏi quyền').first()).toBeVisible(); // the permission mode sits on the prompt card
  const popup = page.getByRole('dialog', { name: /Chi tiết các lệnh/ });
  const openCard = async (text: string) => { await timeline.locator('div[id^="ev-"]', { hasText: text }).getByRole('button', { name: 'Xem chi tiết' }).click(); await expect(popup).toBeVisible(); };

  // Prompt 2: compaction (typed and automatic), the wait, and /clear
  await openCard('thôi, bỏ đi');
  await expect(popup.getByText('Bắt đầu phiên Claude mới (/clear)')).toBeVisible();
  await expect(popup.getByText('Nén hội thoại (bạn ấy gõ /compact)')).toBeVisible();
  await expect(popup.getByText('“giữ lại ý chính”')).toBeVisible();
  await expect(popup.getByText('Nén hội thoại (Claude Code tự nén)')).toHaveCount(2);
  await expect(popup.getByText('Claude đang chờ bạn ấy nhập')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);

  // Prompt 1: model, questions, plan and permission rows
  await openCard('viết hàm tính tổng giỏ hàng');
  await expect(popup.getByText('claude-opus-4-5 → claude-sonnet-4-5')).toBeVisible();
  await expect(popup.getByText('Claude hỏi, bạn ấy chọn')).toBeVisible();
  await expect(popup.getByText('Dùng thư viện nào? → vitest')).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Xem kế hoạch' })).toBeVisible();

  // Permission rows: an inferred answer, always marked as inferred; the forced push was asked for and never ran → "không cho".
  const allowedRows = popup.locator('li[data-kind="permission"]').filter({ hasText: /Đã cho sau ~\d/ });
  await expect(allowedRows).toHaveCount(3);
  await expect(allowedRows.first()).toContainText('(suy ra)');
  const pushRow = popup.locator('li[data-kind="permission"]', { hasText: 'git push --force' });
  await expect(pushRow).toContainText('Không cho (suy ra)');
  await shot(page, 'M22-dong-thoi-gian-moi');

  // The plan opens in the drawer, loaded only when asked.
  await popup.getByRole('button', { name: 'Xem kế hoạch' }).click();
  await expect(page.getByRole('complementary', { name: /Output/ }).getByText('1. Viết hàm add')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);

  // ── A flag chip opens the popup that holds the events behind it and highlights the row ─────────────
  const header = page.getByLabel('Cờ gợi ý', { exact: true });
  await expect(header.getByText('Gợi ý để bạn xem, không phải đánh giá.')).toBeVisible();
  await header.getByRole('button', { name: /Đụng vào test/ }).click();
  await expect(popup).toBeVisible();
  const editRow = popup.locator('li', { hasText: 'src/cart.test.ts' });
  await expect(editRow).toHaveCSS('box-shadow', /rgb/);
  await expect(editRow).toBeInViewport();
  await page.keyboard.press('Escape');
  await header.getByRole('button', { name: /Lệnh nguy hiểm/ }).click();
  await expect(pushRow).toBeInViewport();
  await shot(page, 'M23-nhay-toi-su-kien');
  await page.keyboard.press('Escape');

  // ── Auto-accept allowed for a training: that flag never goes up ───────────────────────────────────
  await page.goto('/admin/trainings');
  await page.getByRole('checkbox', { name: /Cho phép chế độ tự chấp nhận/ }).check();
  await page.getByLabel('Tên buổi').fill('Buổi cho phép tự chấp nhận');
  await page.getByRole('button', { name: 'Tạo buổi' }).click();
  await expect(page).toHaveURL(/\/admin\/trainings\/\d+$/);
  const id2 = Number(page.url().match(/trainings\/(\d+)/)![1]);
  const code2 = (await page.getByLabel(/^Mã phòng \d/).getAttribute('aria-label'))!.replace(/\D/g, '');
  const nam = await joinMember(members, id2, code2, 'Nam', '10.39.0.3');
  await nam.send(hook.prompt('tạo file README', 'bypassPermissions'));
  await expect(page.locator('tr', { hasText: 'Nam' }).getByText('Đã nhận tín hiệu')).toBeVisible({ timeout: 4_000 });
  await expect(page.locator('[data-flag="auto_accept"]')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Tổng hợp lớp' })).toHaveCount(0);

  await mentor.context.close();
});
