# S40: Training: đánh dấu ví dụ, ghi chú và xuất báo cáo trước khi kết thúc

**Phụ thuộc:** S38, S39 · **Trạng thái:** ✅ xong

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
- [x] Báo cáo gồm tổng hợp lớp và từng member có tên: cờ, số liệu, ví dụ đã đánh dấu, ghi chú.
- [x] Báo cáo **không** có output hay nội dung file. Chuỗi giống bí mật bị che (có test với các mẫu khoá phổ biến).
- [x] Member đã dừng gửi mà mentor chưa duyệt xoá vẫn có trong báo cáo, ghi "đã dừng gửi". Member đã bị purge thì không có.
- [x] Kết thúc xoá dấu và ghi chú. Buổi `ended` trả 409 cho báo cáo.
- [x] Bấm Kết thúc khi `report_exported_at` còn trống thì hộp thoại nhắc.

## Test
- Domain: `mask-secrets.test.ts`, test dựng Markdown.
- Tích hợp HTTP: báo cáo (quét không có output, có che bí mật), kết thúc xoá dấu.
- E2E: đánh dấu, ghi chú, tải file. Ảnh chụp vào `docs/design/S40-assets/`.

## Ghi chú khi làm
- Đánh dấu: `PUT|DELETE /trainings/:id/events/:eventId/mark` (lặp lại không đổi gì). Ghi chú: `PUT /trainings/:id/members/:memberId/note` (tối đa 2000 ký tự, rỗng là xoá). Cả hai trả 409 khi buổi đã kết thúc.
- Báo cáo: `GET /trainings/:id/report.md`. `?preview=1` trả cùng nội dung để xem trước và **không** tính là đã xuất; không có `preview` thì tải file và ghi `report_exported_at`.
- Toàn bộ văn bản báo cáo đi qua `maskSecrets` ở bước cuối (cả ghi chú của mentor). Ví dụ đã đánh dấu chỉ có prompt, tên công cụ và đích, không có output, lỗi hay nội dung sửa.
- Sửa kèm theo: mẫu `password|token|...=` trước đây bỏ sót `DB_PASSWORD=...` (dấu `_` bị coi là chữ); cờ "Có thể lộ bí mật" cũng được lợi.
- `ConfirmDialog` giờ có `aria-labelledby`. Hai biểu tượng mới: `bookmark-check`, `download`.
- Khi bật "Ẩn nội dung", hộp thoại xuất không hiện bản xem trước (có tên và prompt), ghi chú cũng ẩn; tải file vẫn được.
- Ảnh chụp: `docs/design/S40-assets/`. Hộp thoại xuất và khối ghi chú chưa qua designer.

## Chưa làm (để sau)
- AI rà phiên từng member (§7.35i).
- Nhắc riêng một member trong buổi.
