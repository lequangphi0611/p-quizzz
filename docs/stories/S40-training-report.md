# S40: Training: đánh dấu ví dụ, ghi chú và xuất báo cáo trước khi kết thúc

**Phụ thuộc:** S38, S39 · **Trạng thái:** ⬜ chưa làm

## Bối cảnh
Kết thúc buổi sẽ xoá dữ liệu. Mentor muốn giữ lại bản góp ý để dùng cho buổi sau. Business: [PRODUCT.md §7.35](../PRODUCT.md) (e).

## Phạm vi
Contract: `architecture.md` §11.9 (Báo cáo).

- **Server**
  - Bảng `training_event_marks`, cột `mentor_note` và `report_exported_at`.
  - Route đánh dấu / bỏ dấu sự kiện, route lưu ghi chú.
  - `GET /trainings/:id/report.md`.
  - `maskSecrets`.
- **Web mentor**
  - Nút đánh dấu trên dòng thời gian, ô ghi chú cho từng member.
  - Hộp thoại xuất: xem trước, trạng thái chưa đánh dấu gì.
  - Nhắc khi bấm Kết thúc mà chưa xuất lần nào.
- Cần designer nhẹ cho hộp thoại xuất và khối ghi chú.

## Acceptance criteria
- [ ] Báo cáo gồm tổng hợp lớp và từng member có tên: cờ, số liệu, ví dụ đã đánh dấu, ghi chú.
- [ ] Báo cáo **không** có output hay nội dung file. Chuỗi giống bí mật bị che (có test với các mẫu khoá phổ biến).
- [ ] Member đã dừng gửi mà mentor chưa duyệt xoá vẫn có trong báo cáo, ghi "đã dừng gửi". Member đã bị purge thì không có.
- [ ] Kết thúc xoá dấu và ghi chú. Buổi `ended` trả 409 cho báo cáo.
- [ ] Bấm Kết thúc khi `report_exported_at` còn trống thì hộp thoại nhắc.

## Test
- Domain: `mask-secrets.test.ts`, test dựng Markdown.
- Tích hợp HTTP: báo cáo (quét không có output, có che bí mật), kết thúc xoá dấu.
- E2E: đánh dấu, ghi chú, tải file. Ảnh chụp vào `docs/design/S40-assets/`.

## Chưa làm (để sau)
- AI rà phiên từng member (§7.35i).
- Nhắc riêng một member trong buổi.
