# S13 — Bảng xếp hạng (API + UI member)

**Phụ thuộc:** S11 · **Song song với:** S12, S15

## Bối cảnh
Bảng xếp hạng tạo không khí thi đua — mục tiêu "đỡ chán". Contract: [architecture.md §6](../architecture.md#6-chấm-điểm--xếp-hạng).

## Phạm vi
- `GET /api/sessions/:id/leaderboard` đúng §6 (dùng `pickCountedAttempt` từ S11). Đồng hạng cùng điểm cùng thời điểm → cùng rank.
- Component `<Leaderboard sessionId highlightName? />` ở `src/web/components/` (S14 tái dùng với kích thước lớn): tự refetch khi nhận event `leaderboard`/`session`; nhãn "Tạm tính" khi `provisional`; tô sáng dòng của chính member.
- Gắn vào màn hình kết quả của member (S12) — nếu S12 chưa merge, chỉ export component và ghi chú trong báo cáo.

## Acceptance criteria
- [ ] Member chưa nộp bài không xuất hiện; người bị kick không xuất hiện.
- [ ] Đề trắc nghiệm làm lại: điểm hiển thị là lượt cao nhất.
- [ ] Sau khi chấm tự luận và chốt phiên, điểm cập nhật và mất nhãn "Tạm tính".

## Test bắt buộc
- API: thứ tự theo điểm, hoà điểm theo thời gian nộp, loại người kick/chưa nộp, `provisional` theo trạng thái.
