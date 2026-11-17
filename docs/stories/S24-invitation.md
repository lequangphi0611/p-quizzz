# S24 — Gửi lời mời nhiều phiên

**Phụ thuộc:** S20 · **Luật:** PRODUCT.md §7.26

## Phạm vi
Chỉ web, giao diện mentor. Không đổi API: `SessionSummary` đã có `roomCode` (chỉ mentor đọc được).

- `features/session-admin/domain/invitation.ts`: `buildInvitation(sessions, host)`, `duplicateTitles`, `isInvitable` (thuần, có test).
- `features/session-admin/ui/InviteDialog.tsx`: tick chọn phiên đang mở, ô tin sửa được, nút "Sao chép tin" (HTTP qua IP có thể chặn clipboard → ô tin vẫn chọn được để tự sao chép).
- Nút "Gửi lời mời" cạnh tiêu đề "Đang mở" ở `SessionListPage`.

## Acceptance criteria
- [x] Tin chỉ có tên đề, trạng thái, link `?room=`, mã phòng; không có tên phiên/tên nhóm/email.
- [x] Một phiên → không đánh số; nhiều phiên → đánh số. Có phiên nhóm → dòng hướng dẫn nhắc nhập email.
- [x] Chọn ≥ 2 phiên cùng đề → cảnh báo vào nhầm phòng.
- [x] Bỏ tick → tin tạo lại; bỏ hết → không sao chép được.
- [x] Link trong tin mở đúng phòng phía member.

## Test
- `domain/invitation.test.ts`
- `e2e/s24-invitation.spec.ts` (ảnh ở `docs/design/S24-assets/`)
