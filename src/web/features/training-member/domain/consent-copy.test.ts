import { describe, expect, it } from 'vitest';
import { HANDLING_ITEMS, NOT_SENT_ITEMS, OTHER_FOLDER_CAVEAT, SECRET_WARNING, SENT_ITEMS, type ConsentItem } from './consent-copy.js';

const all = (items: readonly ConsentItem[]) => items.map(i => `${i.lead} ${i.text}`).join('\n');

describe('consent copy holds to the contract (PRODUCT.md §7.34)', () => {
  const sent = all(SENT_ITEMS);
  it('lists every kind of data that is sent', () => {
    for (const must of ['Prompt', 'tên công cụ', 'câu lệnh', 'pass/fail', 'Output của lệnh', 'nội dung thay đổi file']) expect(sent).toContain(must);
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
    for (const must of ['Chỉ mentor xem', 'không xem lại được', 'Kết thúc', 'Rút lại đồng ý bất cứ lúc nào', 'không mã hoá', 'Không tham gia vẫn học bình thường']) expect(h).toContain(must);
  });
  it('uses only icons that exist in the app', async () => {
    const { readdirSync } = await import('node:fs');
    const have = new Set(readdirSync('src/web/assets/icons').map(f => f.replace(/\.svg$/, '')));
    for (const i of [...SENT_ITEMS, ...NOT_SENT_ITEMS, ...HANDLING_ITEMS]) expect(have.has(i.icon), i.icon).toBe(true);
  });
});
