# S14 — Màn hình chiếu

**Phụ thuộc:** S13 · **Song song với:** S16

## Bối cảnh
Mentor chiếu lên projector để cả nhóm theo dõi. Trang công khai trong LAN (không cần đăng nhập). Business: [PRODUCT.md §4.6](../PRODUCT.md).

## Phạm vi
- `/screen` (dùng `ScreenLayout`): theo dõi phiên đang hoạt động; không có thì phiên gần nhất đã đóng; tự chuyển khi mentor mở phiên mới (poll `/api/sessions/active` 5s + SSE).
- Theo trạng thái:
  - `lobby`: tên đề, **URL để vào** cỡ chữ rất lớn, số người đã vào, lưới tên người tham gia (hiệu ứng nhẹ khi có người mới).
  - `running`: số người đã nộp / tổng, bảng xếp hạng top 10 (`<Leaderboard>` cỡ lớn).
  - `closed`/`finalized`: bảng xếp hạng đầy đủ, nhãn "Tạm tính" hoặc "Kết quả chính thức".
- Hiện thực endpoint công khai `GET /api/sessions/:id/participants` → `{ displayName }[]` (đã có trong architecture.md §5).

## Acceptance criteria
- [ ] Đọc rõ từ xa: chữ chính ≥ 32px ở màn hình 1920×1080, tương phản cao.
- [ ] Không cần thao tác gì trên máy chiếu suốt vòng đời phiên.
- [ ] Không hiển thị đáp án hay bài làm.

## Test bắt buộc
- API participants công khai chỉ trả tên, không trả token/id/status.
