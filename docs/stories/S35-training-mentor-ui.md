# S35 — UI mentor: buổi training AI

**Phụ thuộc:** S34 · **Trạng thái:** ⬜ chưa làm · **UI chờ bản thiết kế** (chưa có prompt designer)

## Bối cảnh
Mentor tạo buổi, chiếu mã cho lớp, theo dõi ai đã kết nối, ai đang kẹt, lướt cách từng member làm, mở output khi cần, rồi Dừng thu và Kết thúc. Business: [PRODUCT.md §7.34](../PRODUCT.md) (a), (f), (g), (h).

## Phạm vi
Contract: `architecture.md` §5 "Buổi training AI" (mentor), §7 (event `training`), §8 (`/admin/trainings`, `/admin/trainings/:id`), §11.8 (Web).

- **Web** `features/training-admin/{domain,application,infrastructure,ui}` theo mẫu §12.1:
  - Trang danh sách + tạo buổi (tên).
  - Trang buổi: mã phòng + link (dùng `/api/network`), bảng member (tên, trạng thái kết nối, số prompt/lệnh/lỗi, cờ "có thể đang kẹt", lần cuối thấy), chọn một member → dòng thời gian (prompt; mỗi lệnh một dòng ✓/✗, thời gian, câu lệnh rút gọn; dòng tóm tắt; nút "Xem output" / "Xem thay đổi" tải chi tiết vào khung cuộn riêng).
  - Khi `stopped`: "Đã gỡ X/N", "Còn N máy vẫn gửi" (không liệt kê tên ở số đếm; bảng member vẫn có trạng thái từng người).
  - Nút "Dừng thu" và "Kết thúc" có hộp xác nhận; "Kết thúc" nói rõ dữ liệu bị xoá vĩnh viễn. "Mời ra" một member (xác nhận).
  - Refetch theo event `training` trên kênh mentor; dòng thời gian tải thêm bằng `after`.
  - Liên kết "Buổi training AI" trong khung `/admin/*`.
- Không có nút chiếu dữ liệu member lên màn hình chiếu (§7.34g).

## Acceptance criteria
- [ ] Tạo buổi → vào trang buổi, thấy mã và link.
- [ ] Member mới kết nối hiện trong ≤ 3 giây mà không tải lại trang.
- [ ] Dòng thời gian không tải output cho tới khi bấm "Xem"; output dài hiển thị phần đầu, dòng "đã lược bỏ N dòng", phần cuối.
- [ ] Cờ kẹt hiện ở bảng member và trên dòng thời gian.
- [ ] Dừng thu → mã biến mất, hiện số đã gỡ / còn gửi; Kết thúc → trang chỉ còn tên, thời gian, số member.
- [ ] Đủ trạng thái: rỗng (chưa ai vào), đang tải, lỗi, mất kết nối SSE.

## Test
- Domain + controller của `features/training-admin` bằng gateway giả.
- E2E `e2e/training-admin.spec.ts`: tạo buổi → member join qua API → gửi JSON hook giả tới ingest → thấy dòng thời gian → xem output → dừng → kết thúc; ảnh vào `docs/design/S35-assets/`.

## Giới hạn đã biết / chưa làm
- Chưa có lọc/tìm trong dòng thời gian, chưa có tóm tắt bằng AI.
