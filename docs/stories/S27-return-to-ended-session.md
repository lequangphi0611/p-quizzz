# S27 — Quay lại kết quả phiên đã kết thúc ("Phiên của bạn trên máy này")

**Phụ thuộc:** S16, S18, S20 · **Trạng thái:** ✅ xong (2026-11-18)

## Bối cảnh
Ở màn "Phiên đã kết thúc", member bấm "Vào phòng khác" thì mất luôn đường vào kết quả và trang "Xem lại bài": tải lại trang không về được, mở lại link phòng cũ thì báo "Mã phòng không đúng" (sai sự thật). Trong chế độ thảo luận member cần mở bài của mình để đối chiếu. Business: [PRODUCT.md §7.29](../PRODUCT.md), §7.16, §4.6.

## Quyết định của PO (2026-11-18)
Phương án "máy này nhớ phiên của mình" (PA2 đầy đủ, qua báo cáo làm rõ yêu cầu). Không làm phương án "server báo phiên đã kết thúc cho mọi mã cũ" vì đi ngược §7.16 (phiên đã đóng không được dò ra). Mặc định: nhớ tới khi member xoá, hiện 10 phiên gần nhất, chấp nhận rủi ro máy dùng chung (có "Xoá khỏi máy này").

## Phạm vi
- **Không đổi server, không đổi contract API.** Trạng thái các phiên trong danh sách lấy từ `GET /api/sessions/:id/public` (đã công khai, chỉ tên đề + trạng thái).
- Web `features/member-join`:
  - Domain `my-sessions.ts` (thuần): danh sách phiên đã vào trên máy này, thêm/cập nhật, quên, tìm theo mã, 10 phiên gần nhất.
  - Port `MySessionsStore` + `LocalStorageMySessionsStore` (key `pq-my-sessions`, không bao giờ throw, dữ liệu hỏng = danh sách rỗng).
  - Controller: ghi nhớ khi vào phiên và mỗi lần tải `/api/me`; mã gõ/link khớp phiên đã nhớ (còn giữ chỗ) → mở thẳng, không gọi `rooms/resolve`; quên khi bị mời ra, bị thay chỗ, token không còn hợp lệ, hoặc member bấm xoá.
  - UI: mục "Phiên của bạn trên máy này" dưới form nhập mã; thông báo trung tính khi mã không dùng được; "Vào phòng khác" thành nút phụ kèm dòng nhắc.

## Acceptance criteria
- [x] Bấm "Vào phòng khác" rồi tải lại trang: thấy mục "Phiên của bạn trên máy này" có phiên vừa rời; bấm vào → về màn kết quả, "Xem lại bài" dùng được.
- [x] Mở lại link/gõ lại mã của phiên đã vào trên máy này → về thẳng phiên đó, không gọi tra mã (không tính lần sai).
- [x] Mã sai và mã của phiên đã đóng (máy chưa từng vào) nhận cùng thông báo trung tính.
- [x] Danh sách chỉ hiện tên đề (không tên phiên), trạng thái, giờ vào; tối đa 10; không có gì thì ẩn mục.
- [x] "Xoá khỏi máy này" có xác nhận; xoá xong không mở lại được từ máy này.
- [x] Bị mời ra / bị thay chỗ / token không hợp lệ → máy tự quên phiên đó.

## Test
- Domain: `member-join/domain/my-sessions.test.ts`.
- Infrastructure: `member-join/infrastructure/member-infrastructure.test.ts` (store).
- Controller: `member-join/application/member-home-controller.test.ts` (describe `my sessions`).
- Thông báo: `member-join/domain/join-error.test.ts`.
- E2E: `e2e/member-after-close.spec.ts`.

## Giới hạn đã biết / chưa làm
- Đổi máy, đổi trình duyệt, tab ẩn danh hoặc xoá dữ liệu trang thì không quay lại được (§7.29, giới hạn 1).
- Phiên vào trước khi có tính năng này chỉ được nhớ sau khi member mở lại nó một lần (lúc đó mới có tên đề và mã).
- UI dựng bằng component sẵn có, chưa qua designer.
