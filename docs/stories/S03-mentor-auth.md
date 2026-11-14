# S03 — Xác thực mentor

**Phụ thuộc:** S01, S02 · **Song song với:** S07

## Bối cảnh
Chỉ mentor được quản lý đề/phiên. App chạy LAN nên chỉ cần mật khẩu cục bộ. Contract: [architecture.md §4, §5 (Mentor: status/setup/login/logout)](../architecture.md).

## Phạm vi
- Cài `@fastify/cookie`. Module `src/server/auth/mentor.ts`: hash/verify bằng `scrypt` (salt ngẫu nhiên, lưu `salt:hash` vào `app_meta.admin_password_hash`), token store `Map`, hook `requireMentor`.
- Route `/api/admin/status|setup|login|logout`. Hook `requireMentor` áp cho mọi `/api/admin/*` khác (đăng ký dạng plugin có prefix để story sau chỉ việc thêm route vào).
- Trang `/admin/login`: nếu chưa setup → form đặt mật khẩu (nhập 2 lần); đã setup → form đăng nhập. Mọi route `/admin/*` khác chưa đăng nhập → chuyển về `/admin/login`. Nút đăng xuất trong `AdminLayout`.
- Test helper `loginAsMentor(app)` trả về header cookie dùng cho `app.inject()`.

## Acceptance criteria
- [ ] `setup` khi đã setup → 409. Mật khẩu < 6 ký tự → 400.
- [ ] Sai mật khẩu → 401, thông báo chung "Sai mật khẩu".
- [ ] Gọi `/api/admin/<bất kỳ route được bảo vệ>` không cookie → 401.
- [ ] Mật khẩu không bao giờ được log hay trả về.

## Test bắt buộc
- Luồng setup → status `loggedIn` → logout → status `loggedIn: false` → login.
- Route bảo vệ mẫu (đăng ký trong test) trả 401 khi không login, 200 khi có cookie.
