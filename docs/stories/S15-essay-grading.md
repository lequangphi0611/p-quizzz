# S15 — Chấm tự luận & chốt phiên

**Phụ thuộc:** S11, S09 · **Song song với:** S12, S13

## Bối cảnh
Đề có tự luận: sau khi đóng phiên, mentor chấm tay theo rubric rồi chốt kết quả chính thức. Contract: [architecture.md §3 (finalize), §5 (grading)](../architecture.md); business: [PRODUCT.md §4.5](../PRODUCT.md).

## Phạm vi
- `GET /api/admin/sessions/:id/grading`: theo từng câu essay (thứ tự `position`) → prompt, body, points, explanation (rubric), danh sách bài của **attempt được tính** mỗi participant `active`: answerId, displayName, textAnswer, manualScore, feedback.
- `PUT /api/admin/answers/:id/grade`: validate 0 ≤ score ≤ points (cho phép số lẻ 0.5), chỉ khi session `closed`; cập nhật `answers.manual_score`, `graded_at`, cộng lại `attempts.manual_score`; publish `leaderboard`.
- Hiện thực `canFinalize` của S06: mọi answer essay của attempt được tính đã có `manual_score` (bài bỏ trống cũng phải được chấm, thường 0 — UI có nút "Chấm 0 cho các bài bỏ trống").
- UI `/admin/sessions/:id/grading`: chọn câu → rubric ghim phía trên → danh sách bài (có thể ẩn tên để chấm khách quan), ô điểm + nhận xét, lưu khi rời ô; tiến độ "đã chấm x/y"; nút "Chốt kết quả" (bật khi đủ điều kiện) → `finalize`.

## Acceptance criteria
- [x] Finalize khi còn bài chưa chấm → 409 nêu số bài còn thiếu.
- [x] Chấm ngoài khoảng điểm → 400.
- [x] Sau finalize không chấm/sửa điểm được nữa (409).

## Test bắt buộc
- API grading list chỉ gồm attempt được tính; grade cập nhật tổng; finalize bị chặn/cho phép đúng điều kiện.
