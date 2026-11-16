# Lộ trình refactor sang Clean Architecture

> Snapshot hiện trạng: ngày 2026-11-16, commit `90caf33`. Source **có thể đã thay đổi** khi một issue được làm, nên mọi issue đều bắt đầu bằng **Bước 0: Scan source** (xem bên dưới).
> Mục tiêu: vừa học, vừa dễ đọc, dễ thêm feature. Không đổi hành vi nghiệp vụ (`PRODUCT.md`) và không đổi API contract (`architecture.md` §5) trong quá trình refactor.

## Quyết định đã chốt

| Mục | Quyết định |
|---|---|
| Mức độ | Clean Architecture đầy đủ: domain / application (use case + port) / infrastructure / interface |
| Port | **Async** (trả `Promise`) để không phụ thuộc `better-sqlite3`. Hệ quả: cần `UnitOfWork` async, xem issue spike P0-3 |
| Composition | Nối bằng tay trong `composition.ts`, không dùng DI container |
| Cách làm | Xen kẽ với story mới; mỗi issue một PR nhỏ, test xanh trước và sau |
| Kiểm tra phụ thuộc | Tự động (dependency-cruiser hoặc test vitest quét import), chốt ở P0-2 |

## Kiến trúc đích

### Backend `src/server/`
```
domain/              # entity, value object, policy. Thuần TS
application/
  ports/             # Repository, UnitOfWork, EventPublisher, Clock, TokenGenerator (async)
  use-cases/<module>/   # 1 file = 1 use case
infrastructure/
  db/                # Drizzle schema, repository implementations, UnitOfWork
  events/            # SSE bus (implement EventPublisher)
interface/http/      # Fastify routes, parse zod, presenter entity -> DTO, auth plugin
composition.ts       # composition root
```
Quy tắc: `interface -> application -> domain`; `infrastructure -> application/domain`; domain không import ai.

### Frontend `src/web/`
```
features/<feature>/
  domain/            # model thuần, quy tắc
  application/       # use case dạng hook/reducer, port: ApiGateway, TokenStore, EventStream
  infrastructure/    # fetch, localStorage, EventSource
  ui/                # page + component, chỉ render và gọi application
shared/              # ui kit, hook hạ tầng, api-client lõi
app/                 # router, layout, composition
```

## Bước 0: Scan source (bắt buộc cho mọi issue)

Issue được viết từ snapshot nên có thể outdate. Trước khi sửa code:

1. Chạy `git log 90caf33..HEAD --stat -- <các đường dẫn trong mục Hiện trạng>` để xem những gì đã đổi.
2. Đọc lại các file liệt kê, đối chiếu với mục **Hiện trạng** của issue.
3. Chạy `npm test` và `npm run typecheck` để có baseline xanh.
4. Xác nhận các issue phụ thuộc đã đóng.
5. Ghi kết quả scan thành **comment đầu tiên** trên issue: khác biệt, file mới hoặc đã xóa, phạm vi điều chỉnh.
6. Lệch lớn (module viết lại, story mới chạm module này, phụ thuộc chưa xong) thì **dừng và báo**, cập nhật issue trước khi làm tiếp.

## Definition of Done (mọi issue)

- [ ] Đã làm Bước 0 và ghi comment scan.
- [ ] `npm test`, `npm run typecheck` và kiểm tra phụ thuộc đều xanh.
- [ ] Hành vi và API không đổi; `leak-guard` vẫn xanh.
- [ ] Không còn code mới viết theo kiểu cũ trong module đã chuyển (không để hai phong cách cùng tồn tại).
- [ ] Cập nhật `docs/architecture.md` / `CLAUDE.md` nếu cấu trúc đổi (trong cùng PR).
- [ ] Báo cáo ngắn: đã làm gì, lệch kế hoạch ở đâu, việc phát sinh.
- Nhánh: `refactor/<slug>`. Thấy việc ngoài phạm vi thì ghi vào báo cáo, không tự làm.

## Danh sách issue và thứ tự

| ID | Việc | Phụ thuộc | Cỡ |
|---|---|---|---|
| P0-1 | Chốt quy tắc layering + quyết định async trong `architecture.md` | — | S |
| P0-2 | Công cụ kiểm tra quy tắc phụ thuộc | P0-1 | S |
| P0-3 | Spike: `UnitOfWork` async trên `better-sqlite3` | P0-1 | S |
| P1-1 | Backend thí điểm: module `exams` | P0-2, P0-3 | M |
| P2-1 | Port dùng chung (`EventPublisher`, `Clock`, `TokenGenerator`) + chuyển logic thuần vào `domain` | P1-1 | M |
| P3-1 | Backend: `sessions` (+ strategy theo `mode`) | P2-1 | M |
| P3-2 | Backend: `participants` + auth + room code | P3-1 | M |
| P3-3 | Backend: `attempts` | P3-2 | L |
| P3-4 | Backend: `grading`, `leaderboard`, `discussion` | P3-3 | M |
| P3-5 | Backend: gỡ `services/`, dọn composition | P3-4 | S |
| P4-1 | Frontend: hạ tầng (api-client, `TokenStore`, `EventStream`) | P0-2 | M |
| P4-2 | Frontend thí điểm: feature `member-exam` | P4-1 | M |
| P5-1 | Frontend: feature `discussion` | P4-2 | M |
| P5-2 | Frontend: `session-admin` + `grading` | P4-2 | M |
| P5-3 | Frontend: `exam-import`, `member-join`, `screen/leaderboard` | P4-2 | M |
| P6-1 | Củng cố: cập nhật tài liệu + trang "Cách thêm feature mới" | tất cả | S |

Backend (P1 đến P3) và frontend (P4 đến P5) độc lập nhau sau P0, có thể làm song song.

## Rủi ro chính

- **Async transaction trên SQLite:** `better-sqlite3` và `db.transaction()` của Drizzle chỉ nhận callback đồng bộ. `UnitOfWork` async cần mở `BEGIN`/`COMMIT` thủ công trên một kết nối duy nhất và **tuần tự hóa** các unit of work (hàng đợi/mutex), nếu không các request xen kẽ sẽ ghi vào cùng transaction. Spike P0-3 phải chứng minh trước khi làm P1.
- **`attempts`** là chỗ dễ hỏng nhất (transaction, rò đáp án). Chỉ làm sau khi mẫu đã ổn; dựa vào test route + `leak-guard`.
- **Bỏ dở giữa chừng** tạo hai phong cách cùng tồn tại. Giảm bằng cách: module nào chuyển thì chuyển hẳn, và lint chặn quay lại kiểu cũ.
- **Story mới chạm module đang refactor:** làm story theo kiểu mới nếu module đã chuyển, theo kiểu cũ nếu chưa, và ghi vào issue tương ứng.

## Checklist thêm feature sau khi refactor xong

1. Đổi quy tắc nghiệp vụ thì sửa `PRODUCT.md` trước, đổi hợp đồng thì sửa `architecture.md`.
2. Backend: entity/policy trong `domain` -> port nếu cần -> use case + test với fake -> repository -> route.
3. DTO đặt trong `src/shared/api`.
4. Frontend: feature mới đủ 4 lớp, `ui` chỉ gọi `application`.
