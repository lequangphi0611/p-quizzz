import { expect, test, type Browser } from '@playwright/test';
import { DESKTOP, LAPTOP, PHONE, importExam, makeSession, memberContext, mentorContext, shotPath } from './helpers';

// S22 — asking the mentor to be let back in when an email/name already has someone behind it (PRODUCT.md §7.23).
const LIST = ['philq@gmail.com', 'phiabc@gmail.com'];

async function rosterSession(browser: Browser, baseURL: string) {
  const mentor = await mentorContext(browser, baseURL, DESKTOP);
  const examId = await importExam(mentor.context.request);
  const session = await makeSession(mentor.context.request, examId, { extra: { name: 'Git – lớp A', access: { kind: 'emails', emails: LIST } } });
  return { mentor, examId, session };
}

async function joinAsPhi(browser: Browser, baseURL: string, code: string, viewport = DESKTOP) {
  const phi = await memberContext(browser, baseURL, viewport);
  await phi.page.goto(`/?room=${code}`);
  await phi.page.getByLabel('Tên của bạn').fill('Phi');
  await phi.page.getByLabel('Email').fill('philq@gmail.com');
  await phi.page.getByRole('button', { name: 'Vào phòng' }).click();
  await expect(phi.page.getByText('Chờ mentor bắt đầu')).toBeVisible();
  return phi;
}

async function askToComeBack(browser: Browser, baseURL: string, code: string, name: string, viewport = PHONE) {
  const asker = await memberContext(browser, baseURL, viewport);
  await asker.page.goto(`/?room=${code}`);
  await asker.page.getByLabel('Tên của bạn').fill(name);
  await asker.page.getByLabel('Email').fill('PhiLQ@gmail.com');
  await asker.page.getByRole('button', { name: 'Vào phòng' }).click();
  await expect(asker.page.getByText('Email này đã có người vào')).toBeVisible();
  return asker;
}

test('"Cho vào lại, giữ bài": the new device takes the seat, the old one is told it was replaced', async ({ browser, baseURL }) => {
  const { mentor, session } = await rosterSession(browser, baseURL!);
  const phi = await joinAsPhi(browser, baseURL!, session.roomCode);

  // ── The second device types the same email: a confirm, never a dead end ─────────────────────────────
  const asker = await askToComeBack(browser, baseURL!, session.roomCode, 'Phi (máy mới)');
  await expect(asker.page.getByText('philq@gmail.com')).toBeVisible(); // only what they typed themselves
  await asker.page.screenshot({ path: shotPath('S22', '1-member-email-taken-phone') });
  await asker.page.getByRole('button', { name: 'Đúng là tôi, xin vào lại' }).click();
  await expect(asker.page.getByText('Đang chờ mentor cho vào lại')).toBeVisible();
  await asker.page.screenshot({ path: shotPath('S22', '2-member-waiting-phone') });

  // ── The mentor sees the request on the session page and in the bell ───────────────────────────────
  const mp = mentor.page;
  await mp.setViewportSize(LAPTOP);
  await mp.goto(`/admin/sessions/${session.id}`);
  await expect(mp.getByText('Xin vào lại · 1')).toBeVisible();
  await expect(mp.getByText('“Phi (máy mới)”')).toBeVisible();
  await expect(mp.getByText('philq@gmail.com').first()).toBeVisible();
  await mp.screenshot({ path: shotPath('S22', '3-mentor-request-block') });
  await mp.locator('body').click({ position: { x: 5, y: 5 } });
  await mp.keyboard.press('n');
  const bell = mp.getByRole('dialog', { name: 'Thông báo' });
  await expect(bell).toContainText('Xin vào lại');
  await expect(bell.getByRole('button', { name: 'Cho vào lại, giữ bài' })).toBeVisible();
  await mp.screenshot({ path: shotPath('S22', '4-mentor-request-bell') });
  await mp.keyboard.press('Escape');

  // ── Keep the work: the new device is in; the old one stops ───────────────────────────────────────
  await mp.getByRole('button', { name: 'Cho vào lại, giữ bài' }).first().click();
  await expect(asker.page.getByText('Chờ mentor bắt đầu')).toBeVisible({ timeout: 15_000 });
  await expect(asker.page.getByText('Phi', { exact: true }).first()).toBeVisible(); // the original name was kept
  await expect(phi.page.getByText('Bài của bạn đang được mở ở thiết bị khác')).toBeVisible({ timeout: 15_000 });
  await phi.page.screenshot({ path: shotPath('S22', '5-old-device-replaced') });
  await expect(mp.getByText('Xin vào lại · 1')).toHaveCount(0);
});

test('"Đây là mạo danh": the holder is sent out, the asker comes in as a new person; "Từ chối" lets nobody in', async ({ browser, baseURL }) => {
  const { mentor, session } = await rosterSession(browser, baseURL!);
  const phi = await joinAsPhi(browser, baseURL!, session.roomCode);
  const impostorAsker = await askToComeBack(browser, baseURL!, session.roomCode, 'Phi thật');
  await impostorAsker.page.getByRole('button', { name: 'Đúng là tôi, xin vào lại' }).click();
  await expect(impostorAsker.page.getByText('Đang chờ mentor cho vào lại')).toBeVisible();

  const mp = mentor.page;
  await mp.setViewportSize(LAPTOP);
  await mp.goto(`/admin/sessions/${session.id}`);
  await mp.getByRole('button', { name: /Đây là mạo danh/ }).first().click();
  const dialog = mp.getByRole('dialog');
  await expect(dialog).toContainText('mất lượt làm bài');
  await mp.screenshot({ path: shotPath('S22', '6-mentor-impostor-confirm') });
  await dialog.getByRole('button', { name: 'Mời ra, cho “Phi thật” vào' }).click();

  await expect(impostorAsker.page.getByText('Chờ mentor bắt đầu')).toBeVisible({ timeout: 15_000 });
  await expect(phi.page.getByText('Bạn đã được mời ra khỏi phiên')).toBeVisible({ timeout: 15_000 });
  await expect(mp.getByRole('cell', { name: 'Phi thật' })).toBeVisible();

  // A third person asks, the mentor says no: the screen says so and offers to try again.
  const third = await askToComeBack(browser, baseURL!, session.roomCode, 'Kẻ khác');
  await third.page.getByRole('button', { name: 'Đúng là tôi, xin vào lại' }).click();
  await expect(mp.getByText('Xin vào lại · 1')).toBeVisible();
  await mp.getByRole('button', { name: 'Từ chối' }).first().click();
  await expect(third.page.getByText('Mentor chưa cho bạn vào lại')).toBeVisible({ timeout: 15_000 });
  await third.page.screenshot({ path: shotPath('S22', '7-member-rejected-phone') });
});

test('a member who drops off shows as disconnected; the mentor lets them back in ahead of time, and that works once', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!, LAPTOP);
  const examId = await importExam(mentor.context.request);
  const session = await makeSession(mentor.context.request, examId, { extra: { name: 'Tự do – ôn Git' } }); // a free session: the name is the identity
  const an = await memberContext(browser, baseURL!, DESKTOP);
  await an.page.goto(`/?room=${session.roomCode}`);
  await an.page.getByLabel('Tên của bạn').fill('An');
  await an.page.getByRole('button', { name: 'Vào phòng' }).click();
  await expect(an.page.getByText('Chờ mentor bắt đầu')).toBeVisible();

  const mp = mentor.page;
  await mp.goto(`/admin/sessions/${session.id}`);
  await expect(mp.getByText('Online')).toBeVisible();
  await mp.screenshot({ path: shotPath('S22', '8-mentor-connection-online') });

  // The member closes the browser: after about 15 seconds of silence the mentor sees "Ngắt từ HH:MM".
  await an.context.close();
  await expect(mp.getByText(/Ngắt từ \d{2}:\d{2}/)).toBeVisible({ timeout: 45_000 });
  await mp.screenshot({ path: shotPath('S22', '9-mentor-connection-dropped') });

  await mp.getByRole('button', { name: 'Cho vào lại' }).click();
  await expect(mp.getByText(/Đã cho phép An vào lại trong 10 phút/)).toBeVisible();
  await expect(mp.getByText(/Cho vào lại · còn \d+ phút/)).toBeVisible();
  await mp.screenshot({ path: shotPath('S22', '10-mentor-allowed-back')  });

  // They come back on another browser: typing the name again is enough, no waiting, no request.
  const back = await memberContext(browser, baseURL!, DESKTOP);
  await back.page.goto(`/?room=${session.roomCode}`);
  await back.page.getByLabel('Tên của bạn').fill('an');
  await back.page.getByRole('button', { name: 'Vào phòng' }).click();
  await expect(back.page.getByText('Chờ mentor bắt đầu')).toBeVisible();
  await expect(mp.getByText(/Cho vào lại · còn/)).toHaveCount(0, { timeout: 15_000 }); // the permission was spent
  await expect(mp.getByText('Online')).toBeVisible({ timeout: 15_000 });

  // Once only: asking in under the same name again is an ordinary clash that goes to the mentor.
  const again = await memberContext(browser, baseURL!, DESKTOP);
  await again.page.goto(`/?room=${session.roomCode}`);
  await again.page.getByLabel('Tên của bạn').fill('An');
  await again.page.getByRole('button', { name: 'Vào phòng' }).click();
  await expect(again.page.getByText('Tên này đã có người dùng')).toBeVisible();
});

test('several members dropping off together read as one event, not a row of warnings', async ({ browser, baseURL }) => {
  const mentor = await mentorContext(browser, baseURL!, LAPTOP);
  const examId = await importExam(mentor.context.request);
  const session = await makeSession(mentor.context.request, examId, { extra: { name: 'Cả lớp' } });
  const members = [];
  for (const name of ['An', 'Bình', 'Chi', 'Dũng']) {
    const m = await memberContext(browser, baseURL!, DESKTOP);
    await m.page.goto(`/?room=${session.roomCode}`);
    await m.page.getByLabel('Tên của bạn').fill(name);
    await m.page.getByRole('button', { name: 'Vào phòng' }).click();
    await expect(m.page.getByText('Chờ mentor bắt đầu')).toBeVisible();
    members.push(m);
  }
  const mp = mentor.page;
  await mp.goto(`/admin/sessions/${session.id}`);
  await expect(mp.getByText('Online')).toHaveCount(4);

  // The class Wi-Fi goes down: three of the four vanish at once.
  await Promise.all(members.slice(0, 3).map(m => m.context.close()));
  const banner = mp.getByRole('status').filter({ hasText: 'ngắt kết nối cùng lúc' });
  await expect(banner).toContainText('3 người', { timeout: 60_000 });
  await expect(banner).toContainText('Bài của họ vẫn được giữ');
  await mp.screenshot({ path: shotPath('S22', '11-mentor-mass-disconnect') });
  await expect(mp.getByText('Online')).toHaveCount(1);
});
