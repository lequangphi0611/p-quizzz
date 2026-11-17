# S23 — Ẩn/hiện điểm theo phiên và giờ nộp cho mentor

**Phụ thuộc:** S09, S13, S14, S18 · **Trạng thái:** ✅ xong (2026-11-17)

## Bối cảnh
Người nộp sớm thấy điểm trắc nghiệm rồi nhắc bài cho người đang làm; mentor muốn tự chọn lúc công bố điểm, và muốn thấy mỗi người nộp lúc nào. Business: [PRODUCT.md §7.25](../PRODUCT.md), §4.2, §4.6. Contract: [architecture.md §2 (`sessions`), §5, §6](../architecture.md).

## Phạm vi
- Cột `sessions.score_visibility` (`on_submit` mặc định | `on_release`) và `scores_released_at` (migration `0007`).
- Quy tắc thuần `domain/session/score-visibility.ts`: điểm **đang giữ** = `on_release`, chưa công bố, phiên chưa `closed` (đóng phiên = công bố, không ghi cột). Chỉ đổi lựa chọn khi chưa ai nộp (kể cả người bị kick), chưa công bố, phiên chưa kết thúc. Công bố chỉ khi đang giữ.
- API mentor: `POST /sessions` nhận `scoreVisibility`; `PUT /sessions/:id/score-visibility`; `POST /sessions/:id/release-scores`. Cả hai phát `session` + `leaderboard`. Chi tiết/summary phiên có `scoreVisibility`, `scoresReleasedAt`, `scoresHidden`.
- Khi đang giữ: `GET /api/me` có `session.scoresHidden = true`, `score`/`essayScore` = `null` (cả response `submit`); bảng xếp hạng công khai trả `hidden: true`, `entries: []`, `submitted` (tên + giờ nộp, theo thứ tự nộp).
- UI mentor: lựa chọn ở form tạo phiên; thẻ "Điểm và bảng xếp hạng" ở trang điều khiển (đổi khi được phép, lý do khi bị khoá, nút "Công bố điểm" có xác nhận, cảnh báo nếu còn người chưa nộp); cột "Nộp lúc" ở trang điều khiển và trang xem lại phiên.
- UI member: thẻ "Đã nộp bài · Điểm sẽ được công bố sau"; bảng "Đã nộp bài · Điểm chưa công bố". Màn chiếu: cùng dạng, đếm "Đã nộp" vẫn đúng.

## Quyết định của PO (2026-11-17)
Ẩn cả điểm lẫn bảng xếp hạng; đóng phiên tự công bố; chỉ đổi khi chưa ai nộp; giờ nộp trên API công khai giữ như cũ (chỉ thêm cột cho mentor). Mặc định phiên mới: hiện ngay.

## Acceptance criteria
- [x] Mặc định `on_submit`: hành vi như trước.
- [x] Đang giữ: response nộp bài, `/api/me`, bảng xếp hạng không chứa điểm/thứ hạng; mentor vẫn thấy điểm.
- [x] Công bố → mọi người thấy điểm ngay (SSE), không ẩn lại được; công bố lần hai → 409.
- [x] Đóng phiên → điểm hiện, không cần công bố.
- [x] Đổi lựa chọn sau khi có người nộp (kể cả đã bị kick) → 409 kèm lý do.
- [x] Mentor thấy giờ nộp từng người.

## Test
- Domain: `domain/session/score-visibility.test.ts`; web `score-visibility-ui.test.ts`, controller test.
- Integration: `test/integration/score-visibility.test.ts` (giữ, công bố, đóng phiên, khoá công tắc, 401/404/409).
- E2E: `e2e/s23-score-visibility.spec.ts` (form tạo phiên → member desktop nộp → màn chiếu → mentor công bố → member và màn chiếu thấy điểm). Ảnh ở `docs/design/S23-assets/` (gitignored).

## Giới hạn đã biết
- API bảng xếp hạng công khai vẫn trả giờ nộp của mọi người (PO chọn giữ nguyên).
- Thứ tự "đã nộp" theo giờ nộp nên ai nộp sớm vẫn nhìn ra được (không lộ điểm).
- UI mới dùng lại component có sẵn, chưa qua designer.
