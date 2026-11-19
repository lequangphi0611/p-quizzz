import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { DESKTOP, PHONE, importExam, makeSession, memberContext, mentorContext, shotPath } from './helpers';

// S31 — share page of finished sessions (PRODUCT.md §7.33). Screenshots go to docs/design/S31-assets/.
const shot = async (p: Page, name: string, fullPage = false) => { await p.waitForTimeout(500); await p.screenshot({ path: shotPath('S31', name), fullPage }); };

type AttemptView = { id: number; questions: { id: number; type: string; options: { id: number; text: string }[] }[] };

/** One member through the API: join, answer with `pick(questionIndex)` (option index, or null to leave blank), submit. */
async function member(api: APIRequestContext, sessionId: number, roomCode: string, name: string, pick: (qi: number) => number | null) {
  const joined = await api.post(`/api/sessions/${sessionId}/join`, { data: { displayName: name, roomCode }, headers: { 'x-forwarded-for': `10.31.0.${name.length}${name.charCodeAt(0) % 9}` } });
  expect(joined.ok(), `join ${name}`).toBeTruthy();
  const { token } = await joined.json() as { token: string };
  const h = { 'x-participant-token': token };
  return {
    token,
    async work() {
      const a = await (await api.post('/api/me/attempts', { headers: h })).json() as AttemptView;
      for (const [qi, q] of a.questions.entries()) {
        const i = pick(qi);
        if (i === null) continue;
        const data = q.type === 'essay' ? { textAnswer: `Bài của ${name}` } : { selectedOptionIds: [q.options[Math.min(i, q.options.length - 1)]!.id] };
        await api.put(`/api/me/attempts/${a.id}/answers/${q.id}`, { headers: h, data });
      }
      expect((await api.post(`/api/me/attempts/${a.id}/submit`, { headers: h })).ok()).toBeTruthy();
      return a.id;
    },
  };
}

test('mentor shares sessions; anyone with the link reads them; old links stop working', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const mentor = await mentorContext(browser, baseURL!, DESKTOP);
  const api = mentor.context.request;
  const examId = await importExam(api);

  // Session A: 6 people. Session B (same exam): 2 people. Session C stays a draft, so the exam has an unfinished session.
  const a = await makeSession(api, examId, { extra: { name: 'Nhóm A – bí mật' } });
  const people = await Promise.all(['An', 'Bình', 'Chi', 'Dũng', 'Em', 'Giang'].map((n, k) => member(api, a.id, a.roomCode, n, qi => (k + qi) % 3 === 0 ? null : (k + qi) % 4)));
  await api.post(`/api/admin/sessions/${a.id}/start`);
  const attempts = [];
  for (const p of people) attempts.push(await p.work());
  await api.post(`/api/admin/sessions/${a.id}/close`);

  const b = await makeSession(api, examId);
  const pair = await Promise.all(['Hà', 'Khoa'].map(n => member(api, b.id, b.roomCode, n, qi => qi % 2)));
  await api.post(`/api/admin/sessions/${b.id}/start`);
  for (const p of pair) await p.work();
  await api.post(`/api/admin/sessions/${b.id}/close`);
  const c = await (await api.post('/api/admin/sessions', { data: { examId } })).json() as { id: number };

  // ── Mentor: review page, share card off, strong warning, on ──────────────────────────────────────
  const m = mentor.page;
  await m.goto(`/admin/sessions/${a.id}/review`);
  await expect(m.getByRole('heading', { name: 'Chia sẻ phiên này' })).toBeVisible();
  await shot(m, 'C9b-share-off');
  await m.getByRole('switch', { name: 'Chia sẻ phiên này' }).click();
  const dialog = m.getByRole('dialog');
  await expect(dialog.getByText('Đề này còn 1 phiên chưa kết thúc')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Vẫn chia sẻ' })).toBeDisabled();
  await shot(m, 'C10b-strong-warning');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Vẫn chia sẻ' }).click();
  await expect(m.getByRole('switch', { name: 'Chia sẻ phiên này' })).toHaveAttribute('aria-checked', 'true');
  await expect(m.getByRole('button', { name: 'Sao chép link chia sẻ' })).toBeEnabled();
  await shot(m, 'C9-share-on');

  // Session B: the few-submissions warning (and still the unfinished one). Delete C first to see only the first.
  await m.goto(`/admin/sessions/${b.id}/review`);
  await m.getByRole('switch', { name: 'Chia sẻ phiên này' }).click();
  await expect(m.getByRole('dialog').getByText('Phiên chỉ có 2 bài nộp')).toBeVisible();
  await shot(m, 'C10c-few-submissions');
  await m.getByRole('dialog').getByRole('checkbox').check();
  await m.getByRole('dialog').getByRole('button', { name: 'Vẫn chia sẻ' }).click();
  await expect(m.getByRole('switch', { name: 'Chia sẻ phiên này' })).toHaveAttribute('aria-checked', 'true');

  // Running sessions cannot be shared: the switch is locked.
  await m.goto(`/admin/sessions/${c.id}/review`);
  await expect(m.getByText('Chỉ chia sẻ được sau khi đóng phiên.')).toBeVisible();
  await shot(m, 'C9c-locked');

  // Session list: the link row and the "Đang chia sẻ" chips.
  await m.goto('/admin/sessions');
  await expect(m.getByText('2 phiên đang chia sẻ · ai có link đều xem được')).toBeVisible();
  await expect(m.getByText('Đang chia sẻ', { exact: true })).toHaveCount(2);
  await shot(m, 'C11-link-row', true);
  const { token } = await (await api.get('/api/admin/share-link')).json() as { token: string };

  // ── Viewer, laptop ───────────────────────────────────────────────────────────────────────────────
  const viewer = await memberContext(browser, baseURL!, DESKTOP);
  const v = viewer.page;
  await v.goto(`/shared/${token}`);
  await expect(v.getByRole('heading', { name: 'Phiên đã thi được chia sẻ' })).toBeVisible();
  await expect(v.getByRole('link', { name: /Ôn tập Git cơ bản/ })).toHaveCount(2);
  await expect(v.getByText('Nhóm A – bí mật')).toHaveCount(0);
  await shot(v, 'A1-list-desktop');
  await v.getByRole('link', { name: /Ôn tập Git cơ bản/ }).nth(1).click(); // the older one: session A
  await expect(v.getByText('Bạn đang xem lại, không có điểm.')).toBeVisible();
  await expect(v.getByText(/· 6 bài nộp$/)).toBeVisible();
  await expect(v.getByText('Bài của An')).toHaveCount(0);
  await shot(v, 'B5-detail-desktop');
  await shot(v, 'B5-detail-desktop-full', true);
  // The essay (question 4): model answer and rubric only, nobody's work.
  const essay = v.locator('#cau-4');
  await essay.scrollIntoViewIfNeeded();
  await expect(essay.getByText('Câu tự luận chỉ có đáp án mẫu và tiêu chí chấm')).toBeVisible();
  await v.waitForTimeout(300);
  await essay.screenshot({ path: shotPath('S31', 'B5-essay-desktop') });
  await v.getByRole('button', { name: 'Câu 3' }).click();
  await expect(v).toHaveURL(/#cau-3$/);
  await v.getByRole('button', { name: 'Danh sách phiên' }).click();
  await expect(v.getByRole('heading', { name: 'Phiên đã thi được chia sẻ' })).toBeVisible();

  // ── Viewer, phone ────────────────────────────────────────────────────────────────────────────────
  const phone = await memberContext(browser, baseURL!, PHONE);
  await phone.page.goto(`/shared/${token}`);
  await expect(phone.page.getByRole('heading', { name: 'Phiên đã thi được chia sẻ' })).toBeVisible();
  await shot(phone.page, 'A1p-list-phone');
  await phone.page.goto(`/shared/${token}/sessions/${a.id}`);
  await expect(phone.page.getByText('Bạn đang xem lại, không có điểm.')).toBeVisible();
  await shot(phone.page, 'B5p-detail-phone');
  const essayPhone = phone.page.locator('#cau-4');
  await essayPhone.scrollIntoViewIfNeeded();
  await phone.page.waitForTimeout(300);
  await essayPhone.screenshot({ path: shotPath('S31', 'B5p-essay-phone') });
  // Scrolling by hand moves the collapsed index along with the page.
  await phone.page.evaluate(() => window.scrollTo(0, document.querySelector('#cau-2')!.getBoundingClientRect().top + window.scrollY - 72));
  await expect(phone.page.getByRole('button', { name: /Mục lục · Câu 2\// })).toBeVisible();
  await phone.page.evaluate(() => window.scrollTo(0, 0));
  await expect(phone.page.getByRole('button', { name: /Mục lục · Câu 1\// })).toBeVisible();
  await phone.page.getByRole('button', { name: /Mục lục/ }).click();
  await shot(phone.page, 'B5p-index-open');
  // Opened directly: "Danh sách phiên" goes to the list.
  await phone.page.getByRole('button', { name: 'Danh sách phiên' }).click();
  await expect(phone.page.getByRole('heading', { name: 'Phiên đã thi được chia sẻ' })).toBeVisible();

  // ── The member who took part sees the notice on their review ────────────────────────────────────
  const an = await memberContext(browser, baseURL!, DESKTOP);
  await an.page.goto('/');
  await an.page.evaluate(([sid, t]) => { localStorage.setItem(`pq:participant:${sid}`, t!); localStorage.setItem('pq-current-session', sid!); }, [String(a.id), people[0]!.token]);
  await an.page.goto(`/review/${attempts[0]}`);
  await expect(an.page.getByText('Mentor đang chia sẻ đề và lời giải của phiên này')).toBeVisible();
  await shot(an.page, 'D13-member-review-notice');

  // ── Unshare B, then rotate the link ───────────────────────────────────────────────────────────────
  await api.put(`/api/admin/sessions/${b.id}/share`, { data: { shared: false } });
  await v.goto(`/shared/${token}/sessions/${b.id}`);
  await expect(v.getByRole('heading', { name: 'Phiên này không còn được chia sẻ' })).toBeVisible();
  await shot(v, 'B7-unshared');

  await m.goto('/admin/sessions');
  await m.getByRole('button', { name: 'Đổi link' }).click();
  await shot(m, 'C11c-rotate-confirm');
  await m.getByRole('dialog').getByRole('button', { name: 'Đổi link' }).click();
  await expect(m.getByRole('dialog')).toHaveCount(0);
  await v.goto(`/shared/${token}`);
  await expect(v.getByRole('heading', { name: 'Link này không mở được' })).toBeVisible();
  await shot(v, 'A4-invalid-link');
});
