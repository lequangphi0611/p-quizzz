# S22 — Xin vào lại khi email/tên đã có người vào

**Phụ thuộc:** S21, S20 (và cơ chế chuông của S19) · **Trạng thái:** ⬜ chưa làm (UI chờ designer: [group-sessions-ui-prompt.md](../design/group-sessions-ui-prompt.md); phần API/domain làm được trước)

## Bối cảnh
Email không xác minh được (app offline), nên ai biết email của bạn mình có thể vào trước. Member thật mất token (đổi trình duyệt, tab ẩn danh) cũng bị kẹt vì "đã có người dùng". Story này thay cách xử lý thủ công của §7.12 bằng luồng xin vào lại, **mentor luôn là người quyết**. Business: [PRODUCT.md §7.23](../PRODUCT.md) (và §7.12, §7.20, §7.21).

**Contract sẽ đổi** ([architecture.md](../architecture.md), cùng commit): §2 (bảng/cột mới), §4 (token member), §5 (API), §7 (không thêm event mới), §8 (chuông).

## Phạm vi

### Định danh bị trùng
- Phiên `roster`: trùng **email** (S21 đã trả 409 `identity_in_use`).
- Phiên `free`: trùng **tên** (409 hiện nay, nay kèm `code: 'identity_in_use'`).
- Cả hai dùng chung một luồng; khoá định danh là email hoặc tên đã chuẩn hoá (không phân biệt hoa thường, không bỏ dấu).

### Member
1. Nhận 409 `identity_in_use` → màn xác nhận: **"Đúng là tôi, xin mentor cho vào lại"** / **"Không phải tôi, nhập lại"**. Không có thông tin nào về người đang giữ chỗ.
2. Chọn "Đúng là tôi" → `POST /api/sessions/:id/rejoin-requests { roomCode, displayName, email? }` → `{ requestId, token }`. Giới hạn theo IP để không spam mentor.
3. Chờ: member poll/SSE trạng thái yêu cầu; **huỷ** được (`POST /api/me/rejoin-requests/cancel`). Kết quả: được vào lại (vào thẳng chỗ đang làm), bị từ chối (gửi lại được), hết hiệu lực (phiên `closed`).
4. **Thiết bị cũ** sau khi bị thay: mọi request trả 403 `code: 'replaced'` → màn "Bài của bạn đang được mở ở thiết bị khác".

### Mentor
- **Yêu cầu vào lại** (chuông + trang điều khiển, gắn tên phiên): thẻ có tên và **trạng thái kết nối** của người đang giữ chỗ (online / ngắt kết nối từ HH:MM), tên người xin vừa nhập, giờ xin.
- `POST /api/admin/rejoin-requests/:id/approve-keep` — **Cho vào lại, giữ bài**: token của người xin thay token của participant; giữ tên hiển thị, bài làm dở/đã nộp, vị trí xếp hạng. Các yêu cầu khác của cùng participant tự bị từ chối.
- `POST /api/admin/rejoin-requests/:id/approve-takeover` — **Đây là mạo danh**: participant đang giữ chỗ → `kicked` (**mất lượt**, vẫn còn trong lịch sử phiên); người xin thành participant mới `active` với tên và email họ nhập (trùng tên người khác → 409 cho mentor, không làm gì). Các yêu cầu khác bị từ chối.
- `POST /api/admin/rejoin-requests/:id/reject`.
- `POST /api/admin/participants/:id/allow-rejoin` — **chủ động cho phép vào lại** (dùng khi thấy ai ngắt kết nối): trong thời hạn ngắn (mặc định 10 phút, dùng một lần) member nhập lại đúng định danh đó thì thay chỗ ngay (như `approve-keep`), không cần chờ. Hết hạn thì thôi.
- `GET /api/admin/sessions/:id`: `participants[].connection { online, lastSeenAt }` và `rejoinRequests[]` (người giữ chỗ, tên người xin, giờ xin).
- **Chuông**: loại thông báo `rejoin` (khoá `rejoin:<requestId>`), nổi bật như người chờ duyệt/xin sửa bài, duyệt/từ chối ngay trong chuông; ba hành động như trên, "Đây là mạo danh" có `ConfirmDialog` nói rõ người bị kick **mất lượt**.

### Trạng thái kết nối (cần có)
`lastSeenAt` cập nhật khi member gọi `/api/me` (poll hiện có), **giới hạn tần suất ghi** (không ghi mỗi request). `online` = `lastSeenAt` trong ngưỡng (đề xuất 3 chu kỳ poll của member; **kiểm tra `POLL_MS` hiện tại** khi làm). Ngưỡng là hằng số trong domain, có test. Chỉ mentor thấy.

## Quy tắc
- **Không bao giờ tự duyệt**, kể cả khi người giữ chỗ ngắt kết nối (test: người giữ chỗ offline + có yêu cầu → vẫn `pending`).
- Nhiều yêu cầu cùng một participant: mentor thấy hết; duyệt một thì các yêu cầu còn lại tự bị từ chối.
- Hết hiệu lực khi phiên `closed` (suy ra khi đọc, như `expired` ở S19). Không lưu lịch sử yêu cầu đã xử lý.
- F5 cùng trình duyệt giữ token → không qua luồng này.
- Gợi ý cài đặt (chốt khi làm): bảng `rejoin_requests` (id, participant_id, claimant_name, token unique, status, created_at, resolved_at). Token của người xin **cũng là token participant tương lai**: trước khi duyệt chỉ cho đọc trạng thái yêu cầu; khi `approve-keep` thì `participants.token := request.token` (thiết bị cũ mất quyền).
- Không lộ email: yêu cầu và response phía member không bao giờ chứa email của người khác; thẻ mentor chỉ hiện email ở phía mentor (§7.24).

## Ngoài phạm vi
Lịch sử yêu cầu đã xử lý. Thông báo desktop riêng cho loại này (dùng chung §7.20 nếu rẻ, không bắt buộc). Xác minh danh tính bằng mã/PIN.

## Acceptance criteria
- [ ] Trùng email (roster) và trùng tên (free) đều dẫn tới màn xác nhận; "Không phải tôi" quay lại form, giữ dữ liệu đã nhập.
- [ ] Yêu cầu tới mentor; `approve-keep`: thiết bị mới vào đúng chỗ (bài dở/đã nộp giữ nguyên, tên hiển thị giữ nguyên), thiết bị cũ nhận 403 `replaced`.
- [ ] `approve-takeover`: người giữ chỗ cũ `kicked`, người xin vào như mới; lượt của người cũ không còn tính vào xếp hạng; xem lại phiên (mentor) vẫn thấy người bị kick.
- [ ] `reject`; member thấy bị từ chối và gửi lại được; phiên `closed` → yêu cầu hết hiệu lực.
- [ ] Hai yêu cầu cho cùng participant (người thật + mạo danh) cùng hiện cho mentor; duyệt một thì cái kia tự bị từ chối.
- [ ] `allow-rejoin`: nhập lại đúng định danh trong hạn → vào thẳng, một lần; quá hạn/đã dùng → quay về luồng xin.
- [ ] Không có đường tự duyệt (test người giữ chỗ offline).
- [ ] Trạng thái kết nối hiện đúng ở bảng điều khiển và thẻ yêu cầu; việc ghi `lastSeenAt` có giới hạn tần suất.
- [ ] Chuông có loại `rejoin` gắn tên phiên; duyệt/từ chối trong chuông được; badge/chấm vàng tính cả loại này.
- [ ] Giới hạn gửi yêu cầu theo IP (test 429).
- [ ] Test quét: response member/công khai không có `email`.
- [ ] `architecture.md` cập nhật; `npm test`, `npm run typecheck`, `npm run arch:check` pass.

## UI (chờ designer)
Theo [group-sessions-ui-prompt.md](../design/group-sessions-ui-prompt.md): A4 (trạng thái kết nối, "Cho vào lại"), A5 (thẻ yêu cầu trong chuông, ba kết quả), B2 (màn xác nhận trùng), B3 (chờ mentor), B4 (thiết bị cũ bị thay).
