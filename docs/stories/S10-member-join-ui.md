# S10 — UI vào phiên & phòng chờ (member)

**Phụ thuộc:** S08 · **Song song với:** S09, S11

## Bối cảnh
Member mở URL trên điện thoại/laptop, nhập tên, chờ mentor bắt đầu. Không có tài khoản. Business: [PRODUCT.md §4.2, §4.3](../PRODUCT.md).

## Phạm vi
- Route `/` là "bộ điều phối" trạng thái member:
  1. Không có phiên hoạt động → "Chưa có phiên thi nào đang mở" (tự cập nhật: poll `/api/sessions/active` mỗi 5s).
  2. Có phiên, chưa có token hợp lệ → form nhập tên → join → lưu token.
  3. Có token → gọi `/api/me`: `pending` → "Đang chờ mentor duyệt"; `active` + `lobby` → phòng chờ (tên đề, tên mình, số người đã vào); `active` + `running` → chỗ cắm màn hình làm bài (S12, tạm hiển thị "Phiên đã bắt đầu"); `kicked` → thông báo + nút vào lại bằng tên khác (xoá token).
  4. Token không hợp lệ/401 → xoá token, về bước 2.
- Đăng ký `useSessionEvents` để chuyển màn hình ngay khi mentor bắt đầu/đóng phiên, hoặc khi được duyệt/bị kick.

## Acceptance criteria
- [x] F5 ở mọi bước giữ đúng trạng thái (không phải nhập lại tên).
- [x] Mentor bấm Bắt đầu → màn hình member đổi trong ≤ 2 giây.
- [x] Dùng tốt trên màn hình 360px, nút đủ lớn để chạm.

## Test bắt buộc
- Không bắt buộc test UI tự động; ghi luồng đã thao tác tay (≥ 2 trình duyệt).
