# S34 — API xem dữ liệu training cho mentor: dòng thời gian, output khi cần, cờ kẹt

**Phụ thuộc:** S33 · **Trạng thái:** ✅ xong

## Bối cảnh
Mentor cần lướt nhanh cách từng member làm (prompt, lệnh, pass/fail, thời gian) mà không bị ngập trong output dài, và biết nên nhìn vào ai. Business: [PRODUCT.md §7.34](../PRODUCT.md) (f), (g).

## Phạm vi
Contract: `architecture.md` §5 (`GET /trainings/:id` đầy đủ, `/members/:memberId/events`, `/events/:eventId/detail`), §11.8 (`isStuck`).

- **Server**
  - Domain: `isStuck`; dựng `summary` (lệnh lỗi: `errorExcerpt`; thành công: dòng cuối có chữ của output).
  - Ports: `listLight`, `getDetail`, `recentTools`, `countsByMember` (§11.8). `listLight` **không** select cột `output_*`/`change_*`.
  - Use cases: `GetTrainingDetail` đầy đủ (`promptCount`, `toolCount`, `failedCount`, `stuck`, `stillSending`, `uninstalled { count, total }` khi `stopped`), `ListMemberEvents` (phân trang `after`, 500 dòng), `GetTrainingEventDetail`.

## Acceptance criteria
- [x] Chi tiết buổi trả đủ các trường của `TrainingMemberRow`; buổi `ended` → `members = []`.
- [x] Dòng thời gian theo thứ tự nhận, phân trang đúng (`after`, `hasMore`); không chứa `output`/`change` (test quét key); có `hasOutput`/`hasChange`.
- [x] `summary` đúng cho lệnh lỗi và lệnh thành công; output rỗng → `summary` null.
- [x] Chi tiết sự kiện trả `Clip` của output và change; sự kiện của buổi khác hoặc buổi `ended` → 404/409.
- [x] `stuck`: 3 lần lỗi liên tiếp cùng câu lệnh → true; có một lần thành công xen giữa → false; prompt xen giữa không cắt chuỗi.
- [x] `uninstalled.count` đếm member `connection = uninstalled`; `stillSending` đúng sau `stop`.

## Test
- Domain: `is-stuck.test.ts`, `summary.test.ts`.
- Use case: fakes trong `application/testing/`.
- Tích hợp HTTP: `test/integration/training-view.test.ts` (ingest giả → đọc dòng thời gian → chi tiết; quét key; buổi `ended`).

## Giới hạn đã biết / chưa làm
- Chưa có tóm tắt chất lượng bằng AI (§7.34j).
- Cờ kẹt chỉ dựa vào lệnh lỗi lặp lại; chưa có "đứng yên lâu".

## Báo cáo hoàn thành (2026-11-20)
- **Đã làm:** `domain/training/{is-stuck,summary}.ts`; phía đọc `TrainingEventReader` (`listLight`, `getDetail`, `recentTools`, `countsByMember`) trong cổng `TrainingEventRepository`, bản Drizzle và bản in-memory; `GetTrainingDetail` có số đếm, `stuck` và `uninstalled` thật; use case `view.ts` (`ListMemberEvents`, `GetTrainingEventDetail`); hai route admin; presenter dựng từng trường.
- **Test:** 1230 test, `typecheck`, `arch:check` đều pass. Test tích hợp `training-view.test.ts` dùng **ingest thật** (S33) để tạo dữ liệu, quét key của dòng thời gian (không `output`/`change`/cột output), phân trang 505 dòng, output 12 500 dòng chỉ làm danh sách nặng dưới 1,5 KB, 404/409/400, 403 từ máy LAN.
- **Quyết định đã chốt (architecture.md §5, §11.8):** `summary` dựng từ hậu tố ≤ 1000 ký tự của output nên danh sách không bao giờ đọc nguyên cột output (không thêm cột, không migration); `isStuck` coi `toolTarget = null` là không lặp lại; `uninstalled.count` đếm theo `connection = 'uninstalled'` (member gửi lại sau khi qua kiểm tra không còn được tính); `stopped` vẫn xem được, `ended` → 409; trường tuỳ chọn bị bỏ khỏi JSON khi không áp dụng.
- **Chưa kiểm:** chưa có dữ liệu từ Claude Code thật; số đếm và cờ kẹt mới được kiểm với payload dựng từ spike. Mỗi lần tải chi tiết buổi, mỗi member tốn một truy vấn `recentTools`: ổn với vài chục người, cần xem lại nếu lớp rất đông.
