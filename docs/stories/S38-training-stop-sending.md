# S38: Training: member dừng gửi, mentor duyệt xoá dữ liệu

**Phụ thuộc:** S35, S36 · **Trạng thái:** ⬜ chưa làm

## Bối cảnh
PO đổi quy tắc (2026-11-21). Member không còn tự xoá dữ liệu khi buổi đang mở. Member bấm "Dừng gửi" thì app ngừng nhận ngay; dữ liệu đã thu được giữ cho tới khi mentor duyệt xoá hoặc bấm Kết thúc; mentor thấy tên người đã dừng. Business: [PRODUCT.md §7.34](../PRODUCT.md) (b) và §7.35 (j).

## Phạm vi
Contract: `architecture.md` §11.9 (Dừng gửi).

- **Server**
  - Cột `stopped_sending_at`.
  - `WithdrawTrainingConsent` đổi sang ghi `stopped_sending_at` thay vì xoá dòng.
  - Ingest với token đã dừng xử lý như buổi `stopped`.
  - `connection` thêm giá trị `stopped_sending`.
  - Route `purge` và use case `PurgeTrainingMember`.
- **Web mentor**
  - Hàng member có chip "Đã dừng gửi" và nút "Duyệt xoá", kèm hộp thoại xác nhận.
- **Web member**
  - Đổi nút "Rút lại đồng ý" thành "Dừng gửi".
  - Hộp thoại nói rõ dữ liệu đã gửi chỉ bị xoá khi mentor duyệt hoặc khi buổi kết thúc.
  - Trạng thái "Đã dừng gửi, chờ mentor xoá" rồi "Đã xoá dữ liệu".
  - Hướng dẫn gỡ hook như khi buổi dừng thu.
  - Câu chữ màn đồng ý cập nhật theo §7.34b.

## Acceptance criteria
- [ ] Buổi `open`: dừng gửi thì sự kiện mới không được lưu và nhận lời nhắc gỡ; dữ liệu cũ còn nguyên; mentor thấy tên kèm `stopped_sending`.
- [ ] Buổi `stopped`: không có hành động dừng gửi; API trả 409.
- [ ] `purge` chỉ chạy được với member đã dừng gửi, khác thì trả 409. Sau `purge`: sự kiện bị xoá (cascade), `me` của member trả 404, bảng mentor không còn dòng đó.
- [ ] Kết thúc vẫn xoá mọi member, kể cả người đã dừng gửi.
- [ ] Người chưa từng đồng ý vẫn không xuất hiện ở đâu.

## Test
- Use case và tích hợp HTTP: dừng gửi rồi ingest, purge, các trường hợp 409, kết thúc.
- E2E: member dừng gửi, mentor thấy tên và duyệt xoá, member thấy "Đã xoá dữ liệu".

## Giới hạn đã biết
- Member vẫn tự gỡ hook được bất kỳ lúc nào; app chỉ quản lý dữ liệu đã nhận.
