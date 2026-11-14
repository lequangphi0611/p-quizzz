# S12 — UI làm bài

**Phụ thuộc:** S10, S11 · **Song song với:** S13, S15

## Bối cảnh
Màn hình member dùng nhiều nhất. Mục tiêu: không mất bài, thao tác nhanh trên điện thoại. Business: [PRODUCT.md §4.3, §4.4](../PRODUCT.md).

## Phạm vi
- Cắm vào bước `active + running` của S10:
  - Chưa có lượt → nút "Bắt đầu làm bài" (kèm số câu, tổng điểm, luật làm lại).
  - Lượt đang dở → vào thẳng màn hình làm bài.
  - Đã nộp → điểm lượt vừa nộp (ghi chú "chưa gồm tự luận" nếu có), nút "Làm lại" khi `canStartNew`, chỗ cắm bảng xếp hạng (S13).
- Màn hình làm bài:
  - Hiển thị từng câu (tiêu đề + body qua `<Markdown>`), đáp án dạng radio (single) / checkbox (multi, ghi rõ "Chọn tất cả đáp án đúng") / textarea (essay, font monospace).
  - Thanh điều hướng số câu: đánh dấu câu đã trả lời; Trước/Sau.
  - **Autosave** mỗi thay đổi (debounce 500ms cho textarea), chỉ báo trạng thái "Đã lưu / Đang lưu / Lỗi lưu — thử lại".
  - Nộp bài: xác nhận, cảnh báo số câu chưa trả lời.
  - Phiên bị đóng khi đang làm (event `session`) → thông báo "Phiên đã đóng, bài của bạn đã được nộp" và chuyển màn hình kết quả.
- F5 giữa chừng → quay lại đúng lượt với câu trả lời đã lưu.

## Acceptance criteria
- [ ] Trả lời vài câu, F5 → câu trả lời còn nguyên.
- [ ] Tắt mạng (DevTools offline) khi trả lời → thấy "Lỗi lưu", bật lại → lưu được.
- [ ] Không chỗ nào trên UI hay trong network response tiết lộ đáp án đúng khi phiên đang chạy.

## Test bắt buộc
- Không bắt buộc test UI tự động; ghi luồng đã thao tác tay (điện thoại giả lập + desktop).
