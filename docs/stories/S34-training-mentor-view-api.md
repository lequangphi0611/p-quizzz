# S34 — API xem dữ liệu training cho mentor: dòng thời gian, output khi cần, cờ kẹt

**Phụ thuộc:** S33 · **Trạng thái:** ⬜ chưa làm

## Bối cảnh
Mentor cần lướt nhanh cách từng member làm (prompt, lệnh, pass/fail, thời gian) mà không bị ngập trong output dài, và biết nên nhìn vào ai. Business: [PRODUCT.md §7.34](../PRODUCT.md) (f), (g).

## Phạm vi
Contract: `architecture.md` §5 (`GET /trainings/:id` đầy đủ, `/members/:memberId/events`, `/events/:eventId/detail`), §11.8 (`isStuck`).

- **Server**
  - Domain: `isStuck`; dựng `summary` (lệnh lỗi: `errorExcerpt`; thành công: dòng cuối có chữ của output).
  - Ports: `listLight`, `getDetail`, `recentTools`, `countsByMember` (§11.8). `listLight` **không** select cột `output_*`/`change_*`.
  - Use cases: `GetTrainingDetail` đầy đủ (`promptCount`, `toolCount`, `failedCount`, `stuck`, `stillSending`, `uninstalled { count, total }` khi `stopped`), `ListMemberEvents` (phân trang `after`, 500 dòng), `GetTrainingEventDetail`.

## Acceptance criteria
- [ ] Chi tiết buổi trả đủ các trường của `TrainingMemberRow`; buổi `ended` → `members = []`.
- [ ] Dòng thời gian theo thứ tự nhận, phân trang đúng (`after`, `hasMore`); không chứa `output`/`change` (test quét key); có `hasOutput`/`hasChange`.
- [ ] `summary` đúng cho lệnh lỗi và lệnh thành công; output rỗng → `summary` null.
- [ ] Chi tiết sự kiện trả `Clip` của output và change; sự kiện của buổi khác hoặc buổi `ended` → 404/409.
- [ ] `stuck`: 3 lần lỗi liên tiếp cùng câu lệnh → true; có một lần thành công xen giữa → false; prompt xen giữa không cắt chuỗi.
- [ ] `uninstalled.count` đếm member `connection = uninstalled`; `stillSending` đúng sau `stop`.

## Test
- Domain: `is-stuck.test.ts`, `summary.test.ts`.
- Use case: fakes trong `application/testing/`.
- Tích hợp HTTP: `test/integration/training-view.test.ts` (ingest giả → đọc dòng thời gian → chi tiết; quét key; buổi `ended`).

## Giới hạn đã biết / chưa làm
- Chưa có tóm tắt chất lượng bằng AI (§7.34j).
- Cờ kẹt chỉ dựa vào lệnh lỗi lặp lại; chưa có "đứng yên lâu".
