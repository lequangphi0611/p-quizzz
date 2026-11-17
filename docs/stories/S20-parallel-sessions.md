# S20 — Nhiều phiên chạy song song

**Phụ thuộc:** S06, S08, S09, S10, S14 · **Trạng thái:** ✅ xong (2026-11-16)

## Bối cảnh
Mentor dạy nhiều nhóm và muốn mỗi nhóm một phiên, chạy cùng lúc. Bỏ luật "tối đa 1 phiên hoạt động". Business: [PRODUCT.md §7.5, §7.16, §7.20](../PRODUCT.md). Đây là **nền tảng** cho S21 (nhóm và email) và S22 (xin vào lại), nên chưa có gì về email ở story này.

**Contract sẽ đổi** (sửa [architecture.md](../architecture.md) trong cùng commit, nêu rõ trong báo cáo): §2 (`sessions.name`), §3 (bỏ điều kiện của `open`), §5 (bỏ `active`/`latest`, thêm tra phiên theo mã, màn chiếu theo phiên), §7 (kênh SSE cho mentor), §8 (route `/screen/:sessionId`).

## Phạm vi

1. **Domain**: `OpenSession` bỏ kiểm tra "không có phiên nào khác ở `lobby`/`running`" (và lỗi tương ứng). Không đặt giới hạn số phiên.
2. **Tên phiên**: cột `sessions.name` (text, not null). `CreateSession` nhận `name?`; mặc định `<tên đề> – dd/MM`. Migration điền phiên cũ bằng tên đề. Hiện ở danh sách phiên, trang điều khiển, chuông và màn chiếu.
3. **Member tra phiên theo mã phòng** (thay `GET /api/sessions/active` cho member):
   - `POST /api/rooms/resolve { roomCode }` → `{ sessionId, name, status }`, chỉ cho phiên `lobby`/`running`. Mã sai **hoặc** phiên không còn mở → cùng một lỗi 403 "Mã phòng không đúng" (không lộ phiên đã đóng). Không bao giờ trả `roomCode`.
   - **Dùng chung bộ giới hạn sai của `join-limiter`** (5 lần sai/phút/IP, 429): không thì quét được 1 triệu mã. Có test chứng minh sai ở `resolve` và `join` cộng dồn vào cùng một bộ đếm.
4. **Màn hình chiếu theo phiên**:
   - Route `/screen/:sessionId`; endpoint mã phòng đổi thành `GET /api/screen/sessions/:id/room` (giữ `requireLocal(false)`, §11.5).
   - `/screen` không kèm id: đúng 1 phiên đang mở → chuyển sang phiên đó; nhiều phiên → trang chọn phiên (`GET /api/screen/sessions` → `{ id, name, status }[]`, **chỉ máy mentor**, `requireLocal(false)`); không có phiên → phiên `closed`/`finalized` gần nhất như hiện nay.
5. **Mentor**:
   - Danh sách phiên hiện nhiều phiên đang mở cùng lúc; `GET /api/admin/sessions?active=true` trả các phiên `lobby`/`running`.
   - Chuông theo dõi **mọi phiên đang mở**, thông báo gắn **tên phiên**, mốc "đã xem" theo từng phiên (đã có `pq:mentor:notices-seen:<sessionId>`), tiêu đề tab `(N)` là tổng.
   - Bỏ mọi chỗ UI/API báo "đang có phiên khác".
6. **Realtime cho mentor** (quyết định cần chốt trong story và ghi vào architecture §7): trình duyệt chỉ cho 6 kết nối/địa chỉ, nên **không** mở một `EventSource` mỗi phiên cho chuông. Đề xuất: một kênh `GET /api/admin/events` (chỉ mentor) gửi `event: participants|session|leaderboard` kèm `data: {"sessionId":N}` (vẫn là tín hiệu "có thay đổi", không đẩy dữ liệu). Trang điều khiển một phiên giữ SSE theo phiên hiện có. Phương án thay thế: chuông poll.
7. **Member web**: `MemberHomeController` bỏ poll `getActive`. Luồng mới: link `/?room=482913` hoặc nhập mã ở URL gốc → `resolve` → form tên → `join`. Token đã lưu theo phiên (`pq:participant:<sessionId>`); khi trình duyệt có token của nhiều phiên thì chọn theo mã đang nhập hoặc phiên nhớ gần nhất còn sống. **Kiểm tra** rằng hai phiên không ghi đè token của nhau.

## Quy tắc
- Mỗi phiên cô lập: người tham gia, bài làm, xếp hạng, SSE, mã phòng. Mã phòng vẫn duy nhất giữa các phiên đang mở (đã có).
- Chế độ thảo luận chiếu một phiên mỗi lúc (không đổi, §7.17). Chấm bài, xem lại: theo id phiên như hiện nay.
- `GET /api/sessions/active` và `/api/sessions/latest` bị **bỏ** (đã có người dùng: member-join, mentor-notices, screen, test); thay bằng các endpoint ở trên.

## Ngoài phạm vi
Nhóm và email (S21). Xin vào lại (S22). Giới hạn số phiên tối đa. Chiếu nhiều phiên cùng lúc trên một màn.

## Acceptance criteria
- [x] Mở và bắt đầu được ≥ 2 phiên cùng lúc, mã phòng khác nhau; `start`/`close`/`finalize` độc lập.
- [x] Cô lập giữa phiên: người của phiên A không xuất hiện ở danh sách/xếp hạng của phiên B; token A không dùng được cho B (test).
- [x] `resolve`: đúng mã → phiên; sai mã hoặc phiên không mở → 403; sai quá 5 lần/phút (cộng cả `join`) → 429; response không chứa mã phòng.
- [x] Member vào được cả từ link `?room=` lẫn nhập mã khi có 2 phiên song song.
- [x] Màn chiếu: `/screen/:id` đúng phiên; `/screen` đúng ở các trường hợp 0, 1, nhiều phiên; `GET /api/screen/*` không mở cho máy khác (cập nhật `require-local.test.ts`).
- [x] Chuông hiện thông báo từ cả hai phiên, mỗi cái gắn tên phiên; badge tính tổng; chỉ mở một kết nối realtime cho chuông bất kể số phiên.
- [x] Tên phiên mặc định đúng; migration chạy trên DB có phiên cũ.
- [x] Các test cũ về "tối đa 1 phiên" được sửa theo luật mới, không bị xoá âm thầm.
- [x] `architecture.md` cập nhật (§2, §3, §5, §7, §8).
- [x] `npm test`, `npm run typecheck`, `npm run arch:check` pass.

## UI (chờ designer)
Theo bản thiết kế UI (mã màn): A1 (tổng quan phiên), A3 (ô tên phiên ở form tạo), A5 (nhãn phiên trong chuông), A7 (màn chiếu), B1 (nhập mã phòng trước, rồi tới tên).

## Đã thao tác tay (Playwright, `e2e/s20-parallel-sessions.spec.ts`, ảnh ở `docs/design/S20-assets/`)
Hai phiên cùng đề ("Git – #member-0908", "Git – lớp chiều") mở song song: tổng quan phiên có 2 thẻ kèm slot 1 và 2 (`1-mentor-overview`); member An vào bằng link `?room=` trên máy tính (`2`, `3`), member Bình gõ mã của phiên kia trên điện thoại 390×844, ô tên chỉ hiện sau khi mã tìm ra phiên (`4`); mỗi phiên chỉ có người của mình (API); bấm `N` mở chuông, thấy cả hai thông báo kèm slot và tên phiên (`5`); `Alt+2` nhảy sang phiên 2; bắt đầu phiên 1 thì phiên 2 vẫn ở phòng chờ; `/screen` hiện trang chọn phiên (`6`), chọn một phiên thì màn chiếu chỉ có mã, tên đề và người của phiên đó, không có tên phiên (`7`); thanh "Đang mở" ở khổ laptop 1280×720 (`8`); đoán sai mã 5 lần qua `resolve` thì `resolve` đúng mã cũng bị 429 và trang member báo "sai quá nhiều lần" (`9`).

## Ghi chú khi làm
- **Tên phiên chỉ mentor thấy** (quyết định PO 2026-11-16): `resolve`, `/api/sessions/:id/public` và màn chiếu chỉ có tên đề; tên phiên nằm ở API mentor và ở `/api/screen/sessions` (chỉ máy mentor).
- **Con trỏ "phiên hiện tại" của member theo từng tab** (sessionStorage, có dự phòng localStorage cho tab mới) để hai tab ở hai phiên song song không đổi token của nhau.
- **Migration `0004`**: thêm `name`, `slot`; sửa tay phần điền dữ liệu cũ (tên = tên đề, phiên đang mở lúc đó lấy slot 1).
- `/api/sessions/active` và `/latest` đã bỏ; bản vẽ designer chưa có màn chọn phiên cho `/screen` nên trang chọn do code dựng (chờ designer xem).
