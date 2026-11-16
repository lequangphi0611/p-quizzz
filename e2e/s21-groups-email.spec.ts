import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, LAPTOP, PHONE, importExam, makeSession, memberContext, mentorContext, shotPath } from './helpers';

// S21 — groups of member emails and sessions limited to them (PRODUCT.md §7.22–7.24).
const PASTED = ['philq@gmail.com', 'PhiABC@Gmail.com', 'phiabc@gmail.com', 'phi78', 'phi89@', 'linh.nguyen@company.vn'].join('\n');

async function openFreshSession(page: Page, sessionId: number) {
  await page.goto(`/admin/sessions/${sessionId}`);
}

test('the mentor builds a group from a pasted list, sees what will be saved, and uses it for a session', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  await importExam(mentor.context.request);
  const page = mentor.page;

  // ── Group editor: paste, preview (merged duplicate, bad line, default domain), save ────────────
  await page.goto('/admin/groups');
  await expect(page.getByText('Chưa có nhóm nào')).toBeVisible();
  await page.getByLabel('Tên nhóm').fill('#member-0908');
  await page.getByLabel('Domain mặc định (tuỳ chọn)').fill('gmail.com');
  await page.getByLabel('Danh sách email').fill(PASTED);
  await expect(page.getByText('4 email hợp lệ')).toBeVisible(); // philq, phiabc, phi78@gmail.com, linh.nguyen
  await expect(page.getByText('Trùng dòng 2, gộp làm một')).toBeVisible();
  await expect(page.getByText('Email chưa đúng định dạng')).toBeVisible();
  await expect(page.getByText('Khi lưu: bỏ 1 dòng lỗi, gộp 1 dòng trùng.')).toBeVisible();
  await page.screenshot({ path: shotPath('S21', '1-group-editor-preview') });
  await page.getByRole('button', { name: /Lưu nhóm · 4 email/ }).click();
  await expect(page.getByText('Đã lưu nhóm · 4 email')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Danh sách nhóm' })).toContainText('#member-0908');
  // The editor now shows exactly what was saved: one clean email per line.
  await expect(page.getByLabel('Danh sách email')).toHaveValue('philq@gmail.com\nphiabc@gmail.com\nphi78@gmail.com\nlinh.nguyen@company.vn');
  await page.screenshot({ path: shotPath('S21', '2-group-saved') });

  // ── Create a session limited to that group ("Chỉ nhóm") ─────────────────────────────────────────
  await page.goto('/admin/sessions');
  await page.getByRole('button', { name: 'Tạo phiên' }).click();
  await page.getByLabel('Đề thi').selectOption({ index: 1 });
  await page.getByLabel('Tên phiên').fill('Git – #member-0908');
  await page.getByRole('radio', { name: 'Chỉ nhóm' }).click();
  await page.getByRole('combobox', { name: /^Nhóm/ }).selectOption({ label: '#member-0908 · 4 email' });
  await page.screenshot({ path: shotPath('S21', '3-create-session-group') });
  await page.getByRole('button', { name: 'Tạo phiên' }).click();
  await expect(page).toHaveURL(/\/admin\/sessions\/\d+$/);
  await expect(page.getByText('Ai được vào')).toBeVisible();
  await expect(page.getByText('Đã vào 0/4')).toBeVisible();
  await page.getByRole('button', { name: /Chưa vào · 4/ }).click();
  await expect(page.getByLabel('Email chưa vào')).toContainText('philq@gmail.com');
  await page.screenshot({ path: shotPath('S21', '4-session-control-roster') });
});

test('members: on the list go straight in, outsiders are turned away (or wait), and no email leaves the mentor', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const api = mentor.context.request;
  const examId = await importExam(api);
  const session = await makeSession(api, examId, {
    extra: { name: 'Git – lớp A', access: { kind: 'emails', emails: ['philq@gmail.com', 'phiabc@gmail.com', 'phi78@gmail.com'] } },
  });

  // ── A member on the list (desktop): the form asks for an email once the code found a roster session ─
  const a = await memberContext(browser, baseURL!, DESKTOP);
  await a.page.goto(`/?room=${session.roomCode}`);
  await expect(a.page.getByLabel('Email')).toBeVisible();
  await a.page.getByLabel('Tên của bạn').fill('Phi');
  await a.page.getByLabel('Email').fill('  PhiLQ@Gmail.com ');
  await a.page.screenshot({ path: shotPath('S21', '5-member-join-email-desktop') });
  await a.page.getByRole('button', { name: 'Vào phòng' }).click();
  await expect(a.page.getByText('Chờ mentor bắt đầu')).toBeVisible(); // no waiting for the mentor to approve
  expect(await a.page.locator('body').innerText()).not.toContain('@');

  // ── An outsider on a phone: one message, the typed values stay ───────────────────────────────────
  const b = await memberContext(browser, baseURL!, PHONE);
  await b.page.goto('/');
  await b.page.getByLabel('Mã phòng').fill(session.roomCode);
  await b.page.getByLabel('Tên của bạn').fill('Lạ');
  await b.page.getByLabel('Email').fill('stranger@gmail.com');
  await b.page.getByRole('button', { name: 'Vào phòng' }).click();
  const refusal = b.page.getByText('Email này không có trong danh sách của phòng. Kiểm tra lại, hoặc nhắn mentor.');
  await expect(refusal).toBeVisible();
  await expect(b.page.getByLabel('Tên của bạn')).toHaveValue('Lạ');
  await expect(b.page.getByLabel('Email')).toHaveValue('stranger@gmail.com');
  await b.page.screenshot({ path: shotPath('S21', '6-member-not-on-list-phone') });

  // The same wording whatever is wrong with the address: nothing to probe the list with.
  await b.page.getByLabel('Email').fill('philq@gmail.vn');
  await b.page.getByRole('button', { name: 'Vào phòng' }).click();
  await expect(refusal).toBeVisible();

  // ── "Cho xin duyệt": the outsider waits for the mentor instead ─────────────────────────────────
  const pendingSession = await makeSession(api, examId, {
    extra: { name: 'Git – lớp B', access: { kind: 'emails', emails: ['philq@gmail.com'] }, outsiderPolicy: 'pending' },
  });
  const c = await memberContext(browser, baseURL!, DESKTOP);
  await c.page.goto(`/?room=${pendingSession.roomCode}`);
  await c.page.getByLabel('Tên của bạn').fill('Lạ');
  await c.page.getByLabel('Email').fill('stranger@gmail.com');
  await c.page.getByRole('button', { name: /Vào phòng|Xin vào phiên/ }).click();
  await expect(c.page.getByText('Chờ mentor duyệt')).toBeVisible();

  // ── Mentor: email column (only here), who is still missing, the waiting outsider ───────────────
  const mp = mentor.page;
  await mp.setViewportSize(LAPTOP);
  await openFreshSession(mp, session.id);
  await expect(mp.getByRole('columnheader', { name: /Email/ })).toBeVisible();
  await expect(mp.getByRole('cell', { name: 'philq@gmail.com' })).toBeVisible();
  await expect(mp.getByText('Đã vào 1/3')).toBeVisible();
  await mp.screenshot({ path: shotPath('S21', '7-mentor-control-email-column') });
  await openFreshSession(mp, pendingSession.id);
  await expect(mp.getByText('stranger@gmail.com · ngoài danh sách')).toBeVisible();
  await mp.screenshot({ path: shotPath('S21', '8-mentor-outsider-waiting') });

  // ── Public and member views carry no email: projector numbers only, API bodies scanned ─────────
  const screen = await mentor.context.newPage();
  await screen.setViewportSize(DESKTOP);
  await screen.goto(`/screen/${session.id}`);
  await expect(screen.getByText('1/3')).toBeVisible(); // "Đã vào 1/3"
  await expect(screen.getByText('Phi', { exact: true })).toBeVisible();
  expect(await screen.locator('body').innerText()).not.toMatch(/@|philq/);
  await screen.screenshot({ path: shotPath('S21', '9-screen-joined-x-of-n') });

  const publicBodies = await Promise.all([
    `/api/sessions/${session.id}/public`, `/api/sessions/${session.id}/participants`, `/api/sessions/${session.id}/leaderboard`, `/api/sessions/${session.id}/roster-counts`,
  ].map(async url => (await a.context.request.get(url)).text()));
  publicBodies.push(await (await a.context.request.get('/api/me')).text());
  for (const body of publicBodies) expect(body).not.toMatch(/@|"email"/);
});

test('a typed list can be saved as a group afterwards; the reminder can be put off', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const api = mentor.context.request;
  const examId = await importExam(api);
  const page = mentor.page;

  // Create with a typed list through the form ("Danh sách tạm").
  await page.goto('/admin/sessions');
  await page.getByRole('button', { name: 'Tạo phiên' }).click();
  await page.getByLabel('Đề thi').selectOption({ index: 1 });
  await page.getByRole('radio', { name: 'Danh sách tạm' }).click();
  await page.getByLabel('Danh sách email').fill('an@x.com\nbinh@x.com\nchi');
  await page.getByLabel('Domain mặc định').fill('x.com');
  await expect(page.getByText('3 email hợp lệ')).toBeVisible();
  await page.screenshot({ path: shotPath('S21', '10-create-session-temp-list') });
  await page.getByRole('button', { name: 'Tạo phiên' }).click();
  await expect(page).toHaveURL(/\/admin\/sessions\/(\d+)$/);
  const id = Number(page.url().split('/').pop());

  // Run it to the end, then the page offers to keep the list.
  for (const step of ['open', 'start', 'close']) await api.post(`/api/admin/sessions/${id}/${step}`);
  await page.reload();
  const banner = page.getByRole('region', { name: 'Lưu danh sách thành nhóm' });
  await expect(banner).toContainText('3 email');
  await page.screenshot({ path: shotPath('S21', '11-save-group-banner') });

  await banner.getByRole('button', { name: 'Lưu thành nhóm' }).click();
  await page.getByLabel('Tên nhóm').fill('#docker-1511');
  await page.screenshot({ path: shotPath('S21', '12-save-group-dialog') });
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu nhóm' }).click();
  await expect(page.getByText('Đã lưu thành nhóm “#docker-1511” · 3 email')).toBeVisible();
  await expect(banner).toHaveCount(0);
  const groups = (await (await api.get('/api/admin/groups')).json()) as { name: string; emailCount: number }[];
  expect(groups.find(g => g.name === '#docker-1511')).toMatchObject({ emailCount: 3 }); // (the server is shared by the specs of a run)

  // "Để sau" hides the reminder for that session without deleting the list.
  const later = await makeSession(api, examId, { extra: { access: { kind: 'emails', emails: ['z@x.com'] } }, steps: ['open', 'start'] });
  await api.post(`/api/admin/sessions/${later.id}/close`);
  await page.goto(`/admin/sessions/${later.id}`);
  await page.getByRole('region', { name: 'Lưu danh sách thành nhóm' }).getByRole('button', { name: 'Để sau' }).click();
  await expect(page.getByRole('region', { name: 'Lưu danh sách thành nhóm' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Lưu danh sách thành nhóm' })).toHaveCount(0);
  expect(((await (await api.get(`/api/admin/sessions/${later.id}`)).json()) as { roster: { size: number } }).roster.size).toBe(1);
});
