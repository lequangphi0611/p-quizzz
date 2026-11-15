# S08 — API vào phiên & quản lý người tham gia

**Phụ thuộc:** S06, S07

## Bối cảnh
Member không có tài khoản: nhập tên khi vào phiên; mentor thấy ai vào, đổi tên/kick, duyệt người vào trễ. Contract: [architecture.md §4 (Member), §5](../architecture.md); business: [PRODUCT.md §4.2, §4.3](../PRODUCT.md).

## Phạm vi
- `POST /api/sessions/:id/join`, hook `requireParticipant`, `GET /api/me` (phần participant + session; phần attempt để trống, S11 bổ sung).
- `PATCH /api/admin/participants/:id`, `POST /api/admin/participants/:id/{kick,approve}`.
- `GET /api/admin/sessions/:id` bổ sung danh sách participants (id, displayName, status, joinedAt).
- Publish `participants` sau mỗi thay đổi.
- Test helper `joinAs(app, sessionId, name)` trả token.

## Quy tắc
- Tên: trim, 1–30 ký tự, gộp khoảng trắng; trùng (không phân biệt hoa thường, bỏ qua người đã kick) → 409 "Tên đã có người dùng".
- Join khi `lobby` → `active`; khi `running` → `pending` (chờ mentor duyệt); khi khác → 409 "Phiên thi không mở".
- Participant `kicked` gọi `/api/me` → 403 "Bạn đã bị mời ra khỏi phiên". Kick người đang làm bài: attempt dở bị bỏ (không tính).
- Approve chỉ áp dụng cho `pending`.
- Join lại cùng trình duyệt: web dùng token đã lưu (S10) — API không cần xử lý đặc biệt.

## Acceptance criteria
- [x] Toàn bộ quy tắc trên có test.
- [x] Token không xuất hiện trong bất kỳ response nào ngoài response của `join`.

## Test bắt buộc
- Join lobby/running/closed; trùng tên; tên rỗng/quá dài; kick → 403; approve pending; rename trùng → 409; event `participants` được publish.
