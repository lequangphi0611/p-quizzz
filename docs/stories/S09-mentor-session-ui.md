# S09 — UI điều khiển phiên (mentor)

**Phụ thuộc:** S05, S08 · **Song song với:** S10, S11

## Bối cảnh
Mentor tạo phiên từ đề, xem lobby realtime, xác nhận số lượng rồi bắt đầu, theo dõi và đóng phiên. Business: [PRODUCT.md §4.2](../PRODUCT.md).

## Phạm vi
- `/admin/sessions`: danh sách phiên (đề, trạng thái, số người, thời gian), nút "Tạo phiên" (chọn đề, bật/tắt trộn — mặc định bật). Hỗ trợ `?examId=` từ S05 để chọn sẵn đề.
- `/admin/sessions/:id`:
  - Thanh trạng thái + nút hành động hợp lệ theo trạng thái (Mở phòng chờ / Bắt đầu / Đóng phiên / Chốt kết quả), có hộp xác nhận cho Bắt đầu và Đóng.
  - Hiển thị **URL cho member** (lấy từ `window.location.host`) to, dễ đọc để đọc/chiếu cho member; link mở `/screen`.
  - Danh sách participant realtime (`useSessionEvents` → refetch): đếm số người `active`, đổi tên inline, kick (xác nhận), khu vực "Chờ duyệt" cho `pending` với nút Duyệt.
  - Khi `running`: cột tiến độ mỗi người (chưa bắt đầu / đang làm / đã nộp, số lượt) — lấy từ `GET /api/admin/sessions/:id`; nếu S11 chưa có dữ liệu attempt thì hiển thị "—".
  - Khi `closed` có tự luận: link "Chấm tự luận" tới `/admin/sessions/:id/grading`.

## Acceptance criteria
- [ ] Mở 2 tab member join → danh sách mentor cập nhật trong ≤ 2 giây không cần F5.
- [ ] Không hiển thị nút hành động không hợp lệ với trạng thái hiện tại.
- [ ] Lỗi API (vd. đang có phiên khác hoạt động) hiển thị thông báo rõ ràng.

## Test bắt buộc
- Không bắt buộc test UI tự động; ghi luồng đã thao tác tay.
