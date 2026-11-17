# S24 — Tiến độ làm bài cho mentor (số câu đã trả lời)

**Phụ thuộc:** S09, S11 · **Trạng thái:** ✅ xong (2026-11-17)

## Bối cảnh
Mentor muốn biết khi nào nên đóng phiên và ai đang bị kẹt. Business: [PRODUCT.md §7.26](../PRODUCT.md), §4.2. Contract: [architecture.md §5](../architecture.md) (`progress.answered`, `exam.questionCount`).

## Phạm vi
- Quy tắc "đã trả lời" dùng chung `src/shared/answered.ts` (`isAnswered`): trắc nghiệm có ≥ 1 lựa chọn, tự luận có chữ. Danh sách câu phía member dùng lại cùng hàm.
- `countAnswered` (domain) đếm số câu đã trả lời của từng lượt từ câu trả lời đã lưu; `computeProgress` nhận `answeredByAttempt`; `answered` chỉ có giá trị khi phiên `running` **và** người đó đang làm (lượt dở), ngược lại `null`. Ngoài `running` server không đọc bảng `answers` cho số này.
- Tổng số câu nằm một lần ở `SessionDetail.exam.questionCount` (không lặp trên từng người).
- `loadSessionProgress` đếm câu đã trả lời của các lượt dở (chỉ đọc cột câu trả lời, không đọc điểm).
- UI mentor: cột Tiến độ hiện "Đang làm · 7/20". Trang điều khiển tự làm mới mỗi 5 giây khi phiên `running` (10 giây ở trạng thái khác); tab bị ẩn thì bỏ lượt làm mới và tải lại ngay khi hiện lại. Lưu câu trả lời **không** phát event.

## Quyết định của PO (2026-11-17)
Đếm đã trả lời (không phải số câu đúng); trễ vài giây được; chỉ hiện khi phiên đang chạy (không ở trang xem lại); chỉ làm cột số câu (chưa làm thanh tổng của phòng, cảnh báo đứng yên).

## Acceptance criteria
- [x] Đang làm: `progress.answered` = số câu đã trả lời, đúng hay sai đều tính; bỏ chọn hết hoặc tự luận toàn khoảng trắng không tính.
- [x] Đã nộp / chưa bắt đầu / phiên đóng: `answered = null`.
- [x] Không lộ số câu đúng; không thay đổi API member, bảng xếp hạng, màn chiếu.
- [x] Trang mentor cập nhật không cần F5 (≤ ~5 giây).

## Test
- Domain: `domain/attempt/attempt.test.ts`, `src/shared/answered.test.ts`. Web: `session-admin/domain/session-ui.test.ts`.
- Integration: `test/integration/attempts.test.ts` (mentor progress).
- E2E: `e2e/s24-answered-progress.spec.ts`; ảnh ở `docs/design/S24-assets/` (gitignored).

## Giới hạn đã biết
- Con số cho biết đã trả lời, không cho biết chất lượng (chọn bừa vẫn tính).
- Trễ tối đa ~5 giây (polling), cộng thêm 0,5 giây debounce khi gõ tự luận.
