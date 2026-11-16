import { expect, test } from '@playwright/test';
import { DESKTOP, LAPTOP, PHONE, importExam, makeSession, memberContext, mentorContext, shotPath } from './helpers';

// S20 — several sessions open at once (PRODUCT.md §7.5). Two sessions of the same exam, two groups of members.
test('two sessions run side by side: own codes, own members, one bell, one bar, one projector chooser', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const api = mentor.context.request;
  const examId = await importExam(api);
  const morning = await makeSession(api, examId, { extra: { name: 'Git – #member-0908' } });
  const afternoon = await makeSession(api, examId, { extra: { name: 'Git – lớp chiều' } });
  expect(morning.roomCode).not.toBe(afternoon.roomCode);

  // ── Mentor overview: both sessions as cards, each with its slot ────────────────────────────────
  await mentor.page.goto('/admin/sessions');
  const cards = mentor.page.locator('article[aria-label^="Phiên "]');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText('Git – #member-0908');
  await expect(cards.nth(1)).toContainText('Git – lớp chiều');
  await expect(mentor.page.getByRole('navigation', { name: 'Phiên đang mở' })).toBeVisible();
  await mentor.page.screenshot({ path: shotPath('S20', '1-mentor-overview') });

  // ── Member A joins from a link with the code in it (desktop) ───────────────────────────────────
  const a = await memberContext(browser, baseURL!, DESKTOP);
  await a.page.goto(`/?room=${morning.roomCode}`);
  await expect(a.page.getByText('Ôn tập Git cơ bản').first()).toBeVisible(); // the exam title, found from the code
  await expect(a.page.getByText('Git – #member-0908')).toHaveCount(0); // the mentor's session name never reaches members
  await a.page.getByLabel('Tên của bạn').fill('An');
  await a.page.screenshot({ path: shotPath('S20', '2-member-link-desktop') });
  await a.page.getByRole('button', { name: 'Vào phòng' }).click();
  await expect(a.page.getByText('Chờ mentor bắt đầu')).toBeVisible();
  await a.page.screenshot({ path: shotPath('S20', '3-member-lobby-desktop') });

  // ── Member B types the other session's code on a phone ─────────────────────────────────────────
  const b = await memberContext(browser, baseURL!, PHONE);
  await b.page.goto('/');
  await expect(b.page.getByLabel('Tên của bạn')).toHaveCount(0); // nothing is asked until a code found a session
  await b.page.getByLabel('Mã phòng').fill(afternoon.roomCode);
  await expect(b.page.getByLabel('Tên của bạn')).toBeVisible();
  await b.page.screenshot({ path: shotPath('S20', '4-member-typed-code-phone') });
  await b.page.getByLabel('Tên của bạn').fill('Bình');
  await b.page.getByRole('button', { name: 'Vào phòng' }).click();
  await expect(b.page.getByText('Chờ mentor bắt đầu')).toBeVisible();

  // ── Isolation: each session only has its own member ────────────────────────────────────────────
  const names = async (id: number) => ((await (await api.get(`/api/sessions/${id}/participants`)).json()) as { displayName: string }[]).map(p => p.displayName);
  expect(await names(morning.id)).toEqual(['An']);
  expect(await names(afternoon.id)).toEqual(['Bình']);

  // ── One bell for both sessions; each notice names its session ──────────────────────────────────
  await mentor.page.reload();
  await mentor.page.locator('body').click({ position: { x: 5, y: 5 } });
  await mentor.page.keyboard.press('n'); // shortcut for the bell
  const bell = mentor.page.getByRole('dialog', { name: 'Thông báo' });
  await expect(bell).toBeVisible();
  await expect(bell).toContainText('An');
  await expect(bell).toContainText('Bình');
  await expect(bell).toContainText('Git – #member-0908');
  await expect(bell).toContainText('Git – lớp chiều');
  await mentor.page.screenshot({ path: shotPath('S20', '5-mentor-bell-two-sessions') });
  await mentor.page.keyboard.press('Escape');

  // ── Alt+2 jumps to the second session ─────────────────────────────────────────────────────────
  await mentor.page.keyboard.press('Alt+Digit2');
  await expect(mentor.page).toHaveURL(new RegExp(`/admin/sessions/${afternoon.id}$`));
  await expect(mentor.page.getByRole('heading', { name: 'Git – lớp chiều' })).toBeVisible();

  // ── Starting one session leaves the other alone ───────────────────────────────────────────────
  await api.post(`/api/admin/sessions/${morning.id}/start`);
  const status = async (id: number) => ((await (await api.get(`/api/admin/sessions/${id}`)).json()) as { status: string }).status;
  expect(await status(morning.id)).toBe('running');
  expect(await status(afternoon.id)).toBe('lobby');
  await expect(a.page.getByText('Chờ mentor bắt đầu')).toHaveCount(0, { timeout: 15_000 }); // A moved on to the exam…
  await expect(b.page.getByText('Chờ mentor bắt đầu')).toBeVisible(); // …B is still waiting

  // ── Projector: the chooser lists both (mentor machine), then one session's own screen ─────────
  const screen = await mentor.context.newPage();
  await screen.setViewportSize(DESKTOP);
  await screen.goto('/screen');
  await expect(screen.getByRole('button', { name: /Git – #member-0908/ })).toBeVisible();
  await expect(screen.getByRole('button', { name: /Git – lớp chiều/ })).toBeVisible();
  await screen.screenshot({ path: shotPath('S20', '6-screen-chooser') });
  await screen.getByRole('button', { name: /Git – lớp chiều/ }).click();
  await expect(screen).toHaveURL(new RegExp(`/screen/${afternoon.id}$`));
  await expect(screen.getByText(afternoon.roomCode.slice(0, 3)).first()).toBeVisible(); // this session's own code
  await expect(screen.getByText('Bình')).toBeVisible();
  await expect(screen.getByText('An', { exact: true })).toHaveCount(0); // the other session's member is not here
  await expect(screen.getByText('Git – lớp chiều')).toHaveCount(0); // the room sees the exam title, never the mentor's name
  await screen.screenshot({ path: shotPath('S20', '7-screen-session') });

  // ── The mentor's control page keeps the session bar at laptop size ────────────────────────────
  await mentor.page.setViewportSize(LAPTOP);
  await mentor.page.goto(`/admin/sessions/${morning.id}`);
  await expect(mentor.page.getByRole('navigation', { name: 'Phiên đang mở' })).toContainText('Git – lớp chiều');
  await mentor.page.screenshot({ path: shotPath('S20', '8-mentor-control-laptop') });
});

test('guessing a room code is slowed down across resolve and join (one counter per address)', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!);
  const examId = await importExam(mentor.context.request);
  const session = await makeSession(mentor.context.request, examId);
  const wrong = session.roomCode === '000000' ? '111111' : '000000';

  const guesser = await memberContext(browser, baseURL!);
  const resolve = (roomCode: string) => guesser.context.request.post('/api/rooms/resolve', { data: { roomCode } });
  for (let i = 0; i < 5; i++) expect((await resolve(wrong)).status()).toBe(403);
  const blocked = await resolve(session.roomCode); // even the right code is refused once the address is spent
  expect(blocked.status()).toBe(429);

  await guesser.page.goto(`/?room=${session.roomCode}`);
  await expect(guesser.page.getByText(/sai quá nhiều lần/)).toBeVisible();
  await guesser.page.screenshot({ path: shotPath('S20', '9-member-locked') });
});
