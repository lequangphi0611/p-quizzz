# S13 — Bảng xếp hạng (API + UI member)

**Phụ thuộc:** S11 · **Song song với:** S12, S15

> **Đã đổi (2026-11-15):** mỗi participant chỉ làm **1 lượt mỗi phiên**, mọi loại đề; muốn làm lại thì mentor mở phiên mới ([PRODUCT.md §4.4, §7.15](../PRODUCT.md)). Các đoạn dưới đây nói về làm lại / lượt điểm cao nhất là bản cũ.

## Bối cảnh
Bảng xếp hạng tạo không khí thi đua — mục tiêu "đỡ chán". Contract: [architecture.md §6](../architecture.md#6-chấm-điểm--xếp-hạng).

## Phạm vi
- `GET /api/sessions/:id/leaderboard` đúng §6 (dùng `pickCountedAttempt` từ S11). Đồng hạng cùng điểm cùng thời điểm → cùng rank.
- Component `<Leaderboard sessionId highlightName? />` ở `src/web/components/` (S14 tái dùng với kích thước lớn): tự refetch khi nhận event `leaderboard`/`session`; nhãn "Tạm tính" khi `provisional`; tô sáng dòng của chính member.
- Gắn vào màn hình kết quả của member (S12) — nếu S12 chưa merge, chỉ export component và ghi chú trong báo cáo.

## Acceptance criteria
- [x] Member chưa nộp bài không xuất hiện; người bị kick không xuất hiện.
- [x] Đề trắc nghiệm làm lại: điểm hiển thị là lượt cao nhất.
- [x] Sau khi chấm tự luận và chốt phiên, điểm cập nhật và mất nhãn "Tạm tính".

## Test bắt buộc
- API: thứ tự theo điểm, hoà điểm theo thời gian nộp, loại người kick/chưa nộp, `provisional` theo trạng thái.
