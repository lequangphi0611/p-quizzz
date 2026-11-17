# S25 — Giới hạn thời gian làm bài

**Phụ thuộc:** S04, S06, S09, S12, S14, S18 · **Trạng thái:** ✅ xong (2026-11-17)

## Bối cảnh
Mentor muốn đặt số phút làm bài; đề có thể khai báo sẵn số phút. Business: [PRODUCT.md §7.27](../PRODUCT.md), §4.2, §6. Format: [exam-format.md](../exam-format.md) (key `duration`). Contract: [architecture.md](../architecture.md) §2 (`exams.duration_minutes`, `sessions.time_limit_minutes`, `sessions.ends_at`), §3 (start/close tự động), §5 (`time-limit`, `extend-time`, `SessionTimer`).

## Quyết định của PO (2026-11-17)
Phương án A: **đồng hồ chung của phiên** (bắt đầu khi mentor bấm Bắt đầu, người vào trễ còn ít giờ hơn), **hết giờ = tự đóng phiên** như bấm Đóng, sau khi bắt đầu **chỉ cộng thêm giờ cho cả phòng**. Key `duration` (1–300 phút, sai là lỗi import). Tính năng được đưa ra khỏi "Ngoài phạm vi".

## Phạm vi
- Parser: key `duration` trong frontmatter → `ParsedExam.durationMinutes`; lưu ở `exams.duration_minutes`; hiện ở trang đề và xem trước import.
- Phiên: `time_limit_minutes` (mặc định theo đề, sửa ở `draft`/`lobby`), `ends_at` gán khi start, `+N phút` khi running. Lưu/nộp/bắt đầu lượt bị 409 sau `ends_at` + 5 giây ân hạn. `CloseExpiredSessions` + `startDeadlineWatcher` (mỗi giây, và lúc khởi động) đóng phiên quá giờ qua đúng luồng `close`.
- DTO `SessionTimer { limitMinutes, endsAt, remainingMs }` cho mentor, `/api/me`, `ActiveSession` (màn chiếu, tra mã phòng). Client đếm ngược từ `remainingMs` (`useCountdown`).
- UI mentor: chọn giới hạn ở form tạo phiên (chọn sẵn theo đề), thẻ "Thời gian làm bài" ở trang điều khiển (sửa trước khi bắt đầu; đồng hồ + "+5 phút"/"+10 phút" khi chạy), đồng hồ cạnh trạng thái.
- UI member: số phút ở phòng chờ và màn bắt đầu, đồng hồ khi làm bài (desktop: header; điện thoại: dính dưới header), màu vàng ở 5 phút, đỏ ở phút cuối, thông báo cho trình đọc màn hình ở 5 phút / 1 phút / hết giờ; 00:00 → lớp phủ "Đã hết giờ" và gửi nốt câu chưa lưu; kết quả ghi "Đã hết giờ làm bài".
- Màn chiếu: số phút ở phòng chờ, đồng hồ lớn "Còn lại" khi chạy (không có thời gian từng người).

## Acceptance criteria
- [x] `duration` hợp lệ được lưu; sai (0, 301, 1.5, chữ) là lỗi có số dòng; trống/không có = không giới hạn.
- [x] Tạo phiên: mặc định theo đề, mentor đổi/tắt được; đổi được ở nháp/phòng chờ, 409 sau khi bắt đầu.
- [x] Bắt đầu đặt một hạn chung; "+N phút" dời hạn cho mọi người; không cộng được khi không giới hạn hoặc chưa chạy.
- [x] Quá hạn + ân hạn: lưu/nộp bị 409, phiên tự đóng, bài dở được nộp, phiên không tự luận chuyển `finalized`; "+N phút" hoặc "Đóng" đến trước thì thắng.
- [x] Member, mentor, màn chiếu thấy cùng một đồng hồ; không ai thấy thời gian của người khác.

## Test
- Parser: `src/shared/exam-format/parse.test.ts` (describe `duration`).
- Domain: `domain/session/time-limit.test.ts`. Use case: `application/use-cases/sessions/time-limit.test.ts`.
- Integration: `test/integration/time-limit.test.ts`.
- Web: `shared/format/countdown.test.ts`, `session-admin/domain/time-limit-ui.test.ts`, `member-exam/application/taking-controller.test.ts` (time up).
- E2E: `e2e/s25-time-limit.spec.ts` (đề 1 phút, chờ thật); ảnh ở `docs/design/S25-assets/` (gitignored).

## Giới hạn đã biết / chưa làm
- Chưa có cộng giờ riêng cho từng người (PRODUCT.md §7.27e).
- Màn sửa bài tự luận sau khi nộp (§7.21) không hiện đồng hồ; server vẫn chặn lưu sau khi hết giờ.
- UI dựng bằng component sẵn có, **chưa qua designer** (báo cáo làm rõ yêu cầu đề xuất có designer cho đồng hồ member/màn chiếu).
