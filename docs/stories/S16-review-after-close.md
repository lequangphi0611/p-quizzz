# S16 — Xem lại bài sau khi đóng phiên

**Phụ thuộc:** S12 · **Song song với:** S14

## Bối cảnh
Giá trị học nằm ở phần này: member xem câu nào sai và vì sao. Chỉ mở khi phiên `closed`/`finalized` để không lộ đáp án khi còn làm lại được. Business: [PRODUCT.md §4.6](../PRODUCT.md).

## Phạm vi
- `GET /api/me/attempts/:id/review`: session chưa đóng → 403 "Đáp án sẽ hiện khi phiên thi kết thúc". Trả mỗi câu (theo thứ tự member đã làm): nội dung, options với `isCorrect`, lựa chọn của member, đúng/sai, điểm, explanation; essay: bài viết, `manualScore` (null nếu chưa chấm), feedback, đáp án mẫu.
- UI: trong màn hình kết quả member (S12), khi phiên đóng → nút "Xem lại bài" (chọn lượt nếu có nhiều lượt) → trang review tái dùng `QuestionPreview` (S05): tô xanh đáp án đúng, tô đỏ lựa chọn sai của member, hiển thị giải thích; essay hiển thị điểm/nhận xét hoặc "Chưa chấm".
- Khi phiên chuyển sang `closed` lúc member đang ở màn hình kết quả → nút xuất hiện ngay (event `session`).

## Acceptance criteria
- [ ] Gọi review khi phiên `running` → 403.
- [ ] Member chỉ xem được lượt của mình.
- [ ] Sau finalize, điểm/nhận xét tự luận hiển thị đúng.

## Test bắt buộc
- API: 403 trước khi đóng, nội dung đúng sau khi đóng, chặn xem lượt của người khác.
