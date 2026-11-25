import { describe, expect, it } from 'vitest';
import { consentSummary, HANDLING_ITEMS, REQUIRED_CHECKBOX_LABEL, TEACHING_BADGE, TEACHING_CHECKBOX_LABEL, TEACHING_ITEMS, TEACHING_TITLE, NOT_SENT_ITEMS, OTHER_FOLDER_CAVEAT, PERMISSION_RISK, SECRET_WARNING, SENT_ITEMS, type ConsentItem } from './consent-copy.js';

const all = (items: readonly ConsentItem[]) => items.map(i => `${i.lead} ${i.text}`).join('\n');

describe('consent copy holds to the contract (PRODUCT.md §7.34)', () => {
  const sent = all(SENT_ITEMS);
  it('lists every kind of data that is sent', () => {
    for (const must of ['Prompt', 'tên công cụ', 'câu lệnh', 'pass/fail', 'Output của lệnh', 'nội dung thay đổi file']) expect(sent).toContain(must);
  });
  it('lists the data added by §7.35: permission requests, questions and plans, the session and the permission mode', () => {
    for (const must of ['Claude xin quyền', 'suy ra', 'Câu Claude hỏi và lựa chọn', 'kế hoạch', 'góp ý khi từ chối kế hoạch không được gửi', '/clear', '/compact', 'chế độ quyền']) expect(sent).toContain(must);
  });
  it('names the permission-hook risk: another machine at that address can approve commands, so remove the config when done', () => {
    expect(PERMISSION_RISK).toMatch(/xin quyền/);
    expect(PERMISSION_RISK).toMatch(/tự chạy lệnh trên máy bạn mà không hỏi/);
    expect(PERMISSION_RISK).toMatch(/gỡ cấu hình/);
  });
  it('says the compaction summary is not sent', () => {
    expect(all(NOT_SENT_ITEMS)).toMatch(/bản tóm tắt/);
  });
  it('says stopping does not delete at once: only the mentor\'s approval or the end does, and the mentor knows who stopped', () => {
    const h = all(HANDLING_ITEMS);
    expect(h).toMatch(/Dữ liệu đã gửi chỉ bị xoá khi mentor duyệt xoá hoặc khi mentor bấm "Kết thúc"/);
    expect(h).toMatch(/mentor biết tên người đã dừng/);
    expect(h).not.toMatch(/bị xoá ngay/);
  });
  it('says the training may last several days and collects outside class hours until someone stops it', () => {
    const h = all(HANDLING_ITEMS);
    expect(h).toMatch(/nhiều ngày/);
    expect(h).toMatch(/ngoài giờ học/);
    expect(h).toMatch(/"Dừng thu" hoặc bạn dừng gửi/);
    expect(HANDLING_ITEMS.filter(i => /nhiều ngày/.test(i.lead))).toHaveLength(1);
  });
  it('says the mentor can export a named report', () => {
    expect(all(HANDLING_ITEMS)).toMatch(/xuất báo cáo có tên bạn/);
  });
  it('says the training can last several days and the config stays on the machine until it is removed (PRODUCT.md §7.36g)', () => {
    const h = all(HANDLING_ITEMS);
    expect(h).toMatch(/nhiều ngày/);
    expect(h).toMatch(/Dừng thu/);
    expect(h).toMatch(/cho tới khi bạn gỡ/);
    expect(h).toMatch(/sang mạng khác/);
  });
  it('says the mentor can export all the data, output and file changes included, to an AI service of the mentor\'s choice, and that the app cannot take it back (§7.36g)', () => {
    const h = all(HANDLING_ITEMS);
    expect(h).toMatch(/xuất toàn bộ dữ liệu của bạn, có tên/);
    expect(h).toMatch(/output lệnh và nội dung file thay đổi/);
    expect(h).toMatch(/dịch vụ AI do mentor chọn/);
    expect(h).toMatch(/app không quản lý hay xoá được, kể cả sau khi mentor bấm "Kết thúc"/);
  });
  it('says the Read tool sends only the file name and line count, never the content', () => {
    expect(sent).toMatch(/Read.*chỉ gửi tên file và số dòng/s);
    expect(sent).toMatch(/không gửi nội dung file/);
  });
  it('says output and file content may hold passwords or secrets', () => {
    expect(SECRET_WARNING).toMatch(/mật khẩu/);
    expect(SECRET_WARNING).toMatch(/bí mật/);
  });
  it('does not send Claude\'s answers, and is honest that a command in the exercise folder can still touch other places', () => {
    expect(all(NOT_SENT_ITEMS)).toMatch(/Câu trả lời của Claude/);
    expect(all(NOT_SENT_ITEMS)).toMatch(/thư mục khác/);
    expect(OTHER_FOLDER_CAVEAT).toMatch(/vẫn được gửi/);
    expect(all(NOT_SENT_ITEMS)).not.toMatch(/việc làm ngoài thư mục bài tập/i); // the claim the designer showed to be wrong
  });
  it('says who sees it, that the member cannot look back, when it is deleted, that consent can be withdrawn and that the network is not encrypted', () => {
    const h = all(HANDLING_ITEMS);
    for (const must of ['Chỉ mentor xem', 'không xem lại được', 'Kết thúc', 'Dừng gửi bất cứ lúc nào', 'không mã hoá', 'Không tham gia vẫn học bình thường']) expect(h).toContain(must);
  });
  it('the teaching tick is optional, unticked, and says what the mentor will know and what cannot be taken back (§7.39a)', () => {
    const t = all(TEACHING_ITEMS);
    expect(TEACHING_TITLE).toBe('Dùng prompt của bạn làm ví dụ');
    expect(TEACHING_BADGE).toBe('Tuỳ chọn');
    expect(`${TEACHING_TITLE} ${TEACHING_CHECKBOX_LABEL} ${t}`).not.toMatch(/lớp sau|khoá sau/);
    expect(t).toMatch(/người cùng lớp vẫn có thể đoán ra từ nội dung/);
    expect(REQUIRED_CHECKBOX_LABEL).toContain('Tôi đã đọc và đồng ý');
    expect(TEACHING_CHECKBOX_LABEL).toMatch(/đã bỏ tên/);
    expect(t).toMatch(/mặc định không tick/);
    expect(t).toMatch(/vẫn tham gia/);
    expect(t).toMatch(/"chưa tốt" kèm nhận xét/);
    expect(t).toMatch(/Mentor sẽ biết bạn đã tick/);
    expect(t).toMatch(/Dừng gửi không rút lại việc dùng prompt đã gửi/);
    expect(t).toMatch(/không thu hồi được,? kể cả sau khi mentor bấm "Kết thúc"/);
  });
  it('sums up the two choices in one line', () => {
    expect(consentSummary(true, false)).toBe('Bạn đang chọn: Tham gia · Làm ví dụ: Không');
    expect(consentSummary(true, true)).toBe('Bạn đang chọn: Tham gia · Làm ví dụ: Có');
    expect(consentSummary(false, false)).toBe('Bạn đang chọn: Chưa đồng ý tham gia · Làm ví dụ: Không');
  });
  it('uses only icons that exist in the app', async () => {
    const { readdirSync } = await import('node:fs');
    const have = new Set(readdirSync('src/web/assets/icons').map(f => f.replace(/\.svg$/, '')));
    for (const i of [...SENT_ITEMS, ...NOT_SENT_ITEMS, ...HANDLING_ITEMS, ...TEACHING_ITEMS]) expect(have.has(i.icon), i.icon).toBe(true);
  });
});
