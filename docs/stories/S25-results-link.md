# S25 — Xem lại bài đã chấm qua link

**Phụ thuộc:** S15, S16, S18, S21 · **Trạng thái:** ⏳ chưa làm

## Bối cảnh
Sau khi mentor chốt kết quả, member chỉ xem được bài khi còn giữ trình duyệt đã làm bài. Đổi máy, xoá dữ liệu trình duyệt hay đã vào phiên khác là mất đường xem; luồng xin vào lại (S22) hết hiệu lực khi phiên đóng. Mentor muốn gửi **một link** cho cả lớp, mỗi người tự xem bài của mình (câu hỏi, câu trả lời, điểm, nhận xét). Business: [PRODUCT.md §7.27](../PRODUCT.md), §4.6, §7.14, §7.19. Contract: [architecture.md §2 (`sessions.review_closed_at`, `attempts.view_code`), §5, §8](../architecture.md).

Đã làm trước story này (commit riêng): member không còn thấy điểm/nhận xét tự luận trước khi chốt (§7.19).

## Phạm vi
- **Dữ liệu:** cột `sessions.review_closed_at`, `attempts.view_code` (migration `0008`, điền mã ngẫu nhiên 4 chữ số cho lượt đã nộp sẵn có). Sinh mã khi nộp và khi tự nộp lúc đóng phiên (dùng port sinh số ngẫu nhiên sẵn có để test được).
- **Domain:** quy tắc thuần cho trạng thái xem lại (`not_final` / `open` / `closed`) và so khớp người xem (tên như join, email chuẩn hoá ở phiên `roster`, mã ở phiên tự do; kick hoặc chưa nộp = không khớp).
- **API member/công khai:** `GET /api/sessions/:id/results-info`, `POST /api/sessions/:id/results` (giới hạn sai dùng chung bộ của mã phòng). `GET /api/me/attempts/:id/review` chặn khi đã đóng xem lại, thêm `examTitle`, `sessionDate`. `GET /api/me` trả `viewCode`.
- **API mentor:** `PUT /api/admin/sessions/:id/review-access`; `reviewClosedAt` và `viewCode` ở chi tiết phiên / xem lại người tham gia.
- **leak-guard:** thêm route `POST /api/sessions/:id/results` vào danh sách route review; chặn `viewCode` ngoài `/api/admin/*` và `/api/me`.
- **UI member:**
  - Màn kết quả (phiên tự do): dòng **"Mã xem bài: 1234"** kèm lời nhắc chụp/ghi lại.
  - Màn kết quả khi phiên chuyển sang `finalized` **trong lúc đang mở**: tự chuyển sang `/review/:attemptId`. Mở lại khi đã chốt: nút "Xem bài đã chấm".
  - Trang `/results/:sessionId`: có token phiên → chuyển sang trang xem lại; không có → form tên + mã (phiên nhóm: tên + email); các trạng thái chưa chốt / đã đóng xem lại / không khớp / bị khoá tạm (429) / mất kết nối. Nhớ thông tin đã nhập theo phiên (lỗi storage không làm hỏng trang).
  - Trang xem lại: đầu trang **tên đề + ngày thi**; dùng lại `ReviewPage` cho cả hai đường.
- **UI mentor:** trang xem lại phiên có nút **"Sao chép link xem lại"** (bật khi `finalized`, link dùng địa chỉ LAN như link mã phòng), công tắc **"Đóng xem lại / Mở xem lại"** (có xác nhận khi đóng), cột **"Mã xem bài"** (phiên tự do). Màn chấm có dòng "Học viên sẽ đọc được nhận xét này sau khi chốt kết quả".

## Ngoài phạm vi
- Xem từ ngoài LAN, gửi kết quả qua email/file.
- Danh sách mọi phiên cũ của một người (lịch sử xuyên phiên, PRODUCT.md §5).
- Mentor đổi/cấp lại mã xem bài.

## Acceptance criteria
- [ ] Trước `finalized`: `results` → 403 "Kết quả chưa được chốt"; `results-info.state = 'not_final'`.
- [ ] Phiên tự do: đúng tên + mã → bài của đúng người (đáp án, giải thích, điểm từng câu, nhận xét, tổng chính thức, tên đề + ngày). Sai tên, sai mã, người bị kick, người chưa nộp → cùng một 403; sai 5 lần/phút → 429 (tính chung với mã phòng).
- [ ] Phiên nhóm: tên + email đúng → xem được; mã không được chấp nhận thay email.
- [ ] Không response nào của `results` / `results-info` chứa email hay thông tin người khác.
- [ ] Đóng xem lại → `results` và `/api/me/attempts/:id/review` đều 403 "Mentor đã đóng xem lại bài"; mở lại → xem được. Đóng khi phiên chưa `closed` → 409.
- [ ] `viewCode` có trong `/api/me` của chính member (phiên tự do) và trong API mentor; không có ở bảng xếp hạng, màn chiếu hay `results`.
- [ ] Member đang ở màn kết quả lúc mentor chốt → tự sang trang xem lại.
- [ ] Mentor sao chép được link; màn chấm có dòng nhắc về nhận xét.

## Test
- Domain: trạng thái xem lại, so khớp người xem.
- Integration: `test/integration/results-link.test.ts` (các tiêu chí trên, gồm giới hạn sai dùng chung với `rooms/resolve`), cập nhật `review.test.ts` (đóng xem lại).
- Web: test cho controller trang `/results/:id` và quyết định tự chuyển màn.
- E2E: `e2e/s25-results-link.spec.ts` (member nộp → mentor chấm + chốt → màn member tự chuyển; trình duyệt mới mở link, nhập tên + mã → thấy nhận xét). Ảnh ở `docs/design/S25-assets/`.

## Giới hạn đã biết
- Chỉ dùng được trong LAN, khi máy mentor đang chạy app.
- Phiên nhóm: ai biết tên + email của bạn thì xem được bài bạn đó (PO chấp nhận, 2026-11-17).
- UI mới dùng lại component sẵn có, chưa qua designer; chữ trên màn có thể rà bằng skill `ux-copy`.
