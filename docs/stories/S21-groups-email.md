# S21 — Nhóm học viên và phiên giới hạn theo email

**Phụ thuộc:** S20, S08, S09, S10, S14 · **Trạng thái:** ⬜ chưa làm (UI chờ designer: [group-sessions-ui-prompt.md](../design/group-sessions-ui-prompt.md); phần API/domain làm được trước)

## Bối cảnh
Mentor muốn chỉ người trong lớp mới vào được phiên, và dùng lại danh sách lớp cho nhiều phiên. Business: [PRODUCT.md §7.22, §7.24](../PRODUCT.md) (và §7.7, §7.16). Phiên tự do (chỉ nhập tên) giữ nguyên.

**Contract sẽ đổi** (sửa [architecture.md](../architecture.md) trong cùng commit): §2 (bảng mới, cột mới), §4 (member), §5 (API), §5 "Quy tắc không lộ" (khoá `email`).

## Phạm vi

### Dữ liệu (đề xuất, chốt khi làm)
- `groups` (id, name, created_at, updated_at) và `group_emails` (group_id, email chuẩn hoá; unique theo (group_id, email)).
- `sessions`: thêm `access` (`free` | `roster`), `outsider_policy` (`block` | `pending`, mặc định `block`), `source_group_id?` (chỉ để biết nguồn; `ON DELETE SET NULL`).
- `session_roster` (session_id, email chuẩn hoá; unique): **bản chụp** lúc tạo phiên.
- `participants.email?` (chuẩn hoá). Unique (session_id, email) cho participant chưa bị kick và có email.

### Thuần (`src/shared/`, dùng chung server và web)
- `email-list`: `normalizeEmail` (trim + chữ thường), `parseEmailList(text, defaultDomain?)` → `{ valid, duplicates, invalid }` (có số dòng cho `invalid`). Dòng chưa có `@` thì thêm `@defaultDomain` nếu có. Chỉ kiểm định dạng cơ bản (có một `@`, có phần trước và sau, không khoảng trắng). Test thuần.
- Tên và email so khớp **không phân biệt hoa thường, không bỏ dấu** (khớp luật tên hiện có `displayNameKey`).

### API mentor (`/api/admin`)
| Method | Path | Mô tả |
|---|---|---|
| POST | `/groups/preview` | `{ text, defaultDomain? }` → kết quả `parseEmailList` (không lưu) |
| GET / POST | `/groups` | Danh sách (tên, số email, lần dùng gần nhất) · tạo `{ name, emails[] }` |
| GET / PUT / DELETE | `/groups/:id` | Chi tiết · sửa tên và danh sách · xoá (không ảnh hưởng phiên đã tạo) |
| POST | `/sessions` | Thêm: `access` (`free` \| `{ groupId }` \| `{ emails[] }` nhập nhanh), `outsiderPolicy?` |
| POST | `/sessions/:id/roster` | Thêm email vào **một phiên** (ngoại lệ), không sửa nhóm gốc |
| POST | `/sessions/:id/save-group` | `{ name }` lưu danh sách phiên thành nhóm (dùng cho nhóm tạm) |
| GET | `/sessions/:id` | Thêm: `access`, `outsiderPolicy`, `participants[].email`, `roster: { size, joined, notJoined[] }` (chỉ mentor thấy) |

### API công khai / member
- `POST /api/rooms/resolve` (S20) trả thêm `access: 'free' | 'roster'` để form biết có hiện ô email không. **Không** trả tên nhóm, kích thước danh sách hay domain.
- `POST /api/sessions/:id/join` nhận `{ displayName, roomCode, email? }`:
  - Phiên `roster`: `email` bắt buộc, sai định dạng → 400 riêng. Email **trong** danh sách → participant `active` ngay (đã được duyệt sẵn, bỏ qua `autoApprove`). Email **ngoài** danh sách → `outsider_policy = block`: 403 với **một thông báo chung** "Email này không có trong danh sách của phòng. Kiểm tra lại, hoặc nhắn mentor."; `pending`: vào trạng thái chờ như hiện nay. Email trùng người đã vào → 409 kèm `code: 'identity_in_use'` (S22 xử lý tiếp; ở story này chỉ trả lỗi). Lỗi 403 "không có trong danh sách" **tính vào bộ giới hạn** của `join-limiter` (chống dò danh sách).
  - Phiên `free`: bỏ qua `email` nếu có gửi (không lưu).
- Màn chiếu: `GET /api/sessions/:id/participants` (công khai) thêm `{ joinedCount, rosterSize }` **chỉ cho phiên `roster`**, chỉ số đếm, không tên người chưa vào.
- **Không lộ email**: mở rộng `leak-guard.ts` thêm khoá `email` cho response ngoài `/api/admin/*` (500 + log, giống `isCorrect`); không ghi email vào log.

## Quy tắc
- Danh sách phiên là bản chụp lúc **tạo** phiên; sửa/xoá nhóm sau đó không ảnh hưởng phiên (kể cả `source_group_id` về `NULL`).
- Cùng một email dùng được ở hai phiên song song; trong một phiên một email chỉ một participant (không tính người bị kick).
- Email chỉ mentor thấy: màn chiếu, xếp hạng, phòng chờ member, thảo luận, màn chấm (kể cả khi bỏ "Ẩn tên"), API member đều không có email. Mentor thấy ở quản lý nhóm, trang điều khiển phiên, xem lại phiên.
- Chuyển trạng thái phiên không bị ảnh hưởng.

## Ngoài phạm vi
Xin vào lại khi email trùng (S22). Tên vui ngẫu nhiên. Mở theo cả domain. Xác minh email. Sửa/xoá email trong danh sách của một phiên đang chạy (chỉ thêm).

## Acceptance criteria
- [ ] `parseEmailList`: chuẩn hoá hoa/thường, bỏ trùng (`Phi78@Gmail.com` = `phi78@gmail.com`), báo dòng sai định dạng, thêm domain mặc định; có test thuần.
- [ ] CRUD nhóm; xoá nhóm không đổi danh sách phiên đã tạo (test).
- [ ] Tạo phiên bằng ba cách (`free`, `groupId`, `emails`); danh sách phiên là bản chụp (sửa nhóm sau không đổi phiên).
- [ ] Join phiên `roster`: trong danh sách → `active`; ngoài → chặn (thông báo chung) hoặc chờ duyệt theo `outsiderPolicy`; thiếu/sai định dạng email → 400; email trùng → 409 `identity_in_use`.
- [ ] Thông báo lỗi ngoài danh sách **giống hệt nhau** cho mọi email không có trong danh sách (không lộ gì thêm); sai quá 5 lần/phút từ một IP → 429.
- [ ] Phiên `free` hoạt động như trước (không đòi email).
- [ ] Test quét đệ quy: không response nào ngoài `/api/admin/*` chứa `email`; `leak-guard` bắt được khi cố tình trả (test cho guard).
- [ ] Màn chiếu chỉ nhận được số đếm `joinedCount/rosterSize`, không tên nhóm, không tên người chưa vào.
- [ ] Mentor thêm email vào phiên đang chạy; email đó vào được. "Lưu thành nhóm" từ nhóm tạm tạo đúng nhóm.
- [ ] `architecture.md` cập nhật; `npm test`, `npm run typecheck`, `npm run arch:check` pass.

## UI (chờ designer)
Theo [group-sessions-ui-prompt.md](../design/group-sessions-ui-prompt.md): A2 (quản lý nhóm, xem trước), A3 (bước "Ai được vào?"), A4 (cột email, "Chưa vào", thêm email), A6 (lưu thành nhóm), A7 (số "đã vào X/N"), B1 (form theo loại phiên, lỗi tại chỗ), B5 (người ngoài danh sách). Gợi ý code: feature web mới `features/groups` (mentor), email trong `member-join`; email-list thuần ở `src/shared/`.
