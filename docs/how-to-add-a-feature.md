# Cách thêm một feature mới

Hướng dẫn từng bước, ví dụ lấy từ code thật. Quy tắc gốc nằm ở [architecture.md §9](architecture.md) (layering), §11 (backend mẫu `exams`), §12 (web mẫu `member-exam`). Trang này chỉ nói **làm theo thứ tự nào**.

Ví dụ xuyên suốt: thêm "ghi chú của mentor cho một phiên" (giả định, không có trong code): mentor gõ ghi chú ở trang chi tiết phiên, lưu và đọc lại được.

## Bước 1. Chốt quy tắc trước khi code

1. Đổi quy tắc nghiệp vụ → sửa [PRODUCT.md](PRODUCT.md) **trước**.
2. Đổi bảng dữ liệu, API, tên event, thư viện → sửa [architecture.md](architecture.md) (§1-§8) trong cùng commit.
3. Có đổi schema DB → sửa `src/server/infrastructure/db/schema.ts` rồi `npm run db:generate`.
4. Không chắc một việc có đổi contract hay không → coi như có và ghi rõ trong PR.

## Bước 2. DTO dùng chung: `src/shared/api/`

DTO và schema zod mà **cả web và server** cùng dùng đặt ở `src/shared/api/<module>.ts`, rồi export qua `index.ts`. Ví dụ: `ExamMarkdownBody`, `CreateExamResponse` (`exams.ts`).

- Chỉ TS thuần: không import Node, DOM, `src/server`, `src/web`.
- Không chắc web có cần không → để ở `domain/` của server, chuyển sang `shared/` khi web cần (§9.5).

## Bước 3. Backend (`src/server/`)

Thứ tự từ trong ra ngoài. Mỗi bước có thể chạy test riêng.

| # | Lớp | Việc | Ví dụ thật |
|---|---|---|---|
| 1 | `domain/<module>/` | Entity, value object, policy, lỗi nghiệp vụ. TS thuần, không import gì ngoài `domain` và `src/shared`. | `domain/exam/exam.ts`, `domain/exam/errors.ts` (`ExamNotFoundError`) |
| 2 | `application/ports/` | Interface cho thứ cần I/O. **Trả `Promise`** (§9.3); `Clock`/`TokenGenerator`/`Random` là ngoại lệ đồng bộ. Tách `XxxReader` (đọc, dùng ngoài transaction) và `XxxRepository` (ghi, chỉ trong `UnitOfWork`). | `ports/exam-repository.ts` |
| 3 | `application/use-cases/<module>/` | **Một file = một use case**, tên động từ, class có `execute()`, nhận port qua constructor. | `use-cases/exams/get-exam.ts` (`GetExam`) |
| 4 | `application/testing/` + test | Fake in-memory (`InMemoryXxxRepository`) và test use case, **không Fastify, không DB**. Có ghi thì dùng `InMemoryUnitOfWork` để test rollback. | `testing/in-memory-exam-repository.ts`, `use-cases/exams/exams.test.ts` |
| 5 | `infrastructure/db/` | `DrizzleXxxRepository` implement port; test với `createDb(':memory:')`. SQL chỉ nằm ở đây. | `db/drizzle-exam-repository.ts` (+ `.test.ts`) |
| 6 | `interface/http/` | Route Fastify: parse zod → gọi **một** use case → presenter entity→DTO. Bắt lỗi domain bằng `sendDomainError`. Không bao giờ trả thẳng row/entity (rò đáp án). | `exams-routes.ts`, `presenters/exam-presenter.ts` |
| 7 | `composition.ts` | Nối tay: tạo repository, bọc `SqliteUnitOfWork`, `new UseCase(...)`, thêm vào `Composition`. Đây là nơi **duy nhất** `interface` và `infrastructure` gặp nhau. | `composition.ts` (`examReader`, `examUnitOfWork`) |
| 8 | `app.ts` | Đăng ký plugin route (mentor: trong scope `requireMentor` của `/api/admin`). | `app.ts` |
| 9 | `test/integration/` | Test HTTP bằng `createTestApp()` + `app.inject()`. | `test/integration/exams.test.ts` |

Ví dụ rút gọn cho "ghi chú phiên": `domain/session/session-note.ts` → port `SessionNoteRepository` → use case `SaveSessionNote`/`GetSessionNote` → fake + test → `DrizzleSessionNoteRepository` → `PUT/GET /api/admin/sessions/:id/note` → nối trong `composition.ts`.

Lưu ý:
- Route **không** import `infrastructure`; use case **không** import `fastify`/`drizzle-orm`. `arch:check` sẽ báo.
- Endpoint cho member không được lộ `isCorrect`/`explanation`. `leak-guard` chặn ở `onSend` (trả 500) nhưng đừng dựa vào nó: dựng DTO từng trường ở presenter, và thêm test không lộ đáp án (§5).
- Phát event realtime: inject `EventPublisher` vào use case, không gọi bus trực tiếp.

## Bước 4. Frontend (`src/web/`)

Feature mới là một thư mục `features/<tên>/` đủ 4 lớp. Mẫu chuẩn: `features/member-exam` (xem §12.1); ví dụ có controller + loader: `features/session-admin`.

```
features/session-note/
  domain/           # hàm thuần, kiểu, quy tắc UI. Không import react
  application/      # port (Gateway), controller/hook, loader của router
  infrastructure/   # HttpXxxGateway: fetch, localStorage, EventSource
  ui/               # trang + component. Chỉ gọi application
```

| # | Lớp | Việc | Ví dụ thật |
|---|---|---|---|
| 1 | `domain/` | Logic thuần + test (ví dụ quy tắc "có gì chưa lưu"). | `member-exam/domain/answer-progress.ts` |
| 2 | `application/` | Port `XxxGateway` (interface); controller thuần TS (`getState`/`subscribe`/`set`) test bằng fake gateway + fake timers; hook `useXxx` bọc bằng `useSyncExternalStore`; context để nhận gateway. Tạo controller trong `useEffect`/`useState` (StrictMode chạy effect hai lần). | `member-exam/application/exam-gateway.ts`, `taking-controller.ts`, `use-taking-exam.ts`, `exam-gateway-context.tsx` |
| 3 | `infrastructure/` | `HttpXxxGateway` nhận `api` (client lõi) qua constructor + test với fetch giả. | `member-exam/infrastructure/http-exam-gateway.ts` |
| 4 | `ui/` | Trang và component: nhận state/hành động từ hook `application`, **không** import `infrastructure`. Dùng `shared/ui` (Button, Card, TextField...). Chữ hiển thị tiếng Việt. | `member-exam/ui/MemberExamPage.tsx` |
| 5 | `app/composition.ts` | `export const xxxGateway = new HttpXxxGateway(api)`: nơi **duy nhất** `new Http*Gateway`. | `app/composition.ts` |
| 6 | `app/AppProviders.tsx` | Bọc provider/context của gateway. | `AppProviders.tsx` |
| 7 | `app/router.tsx` | Thêm route; loader tạo từ factory trong `application` (`createXxxLoaders(gateway)`) và gắn gateway ở đây. | `router.tsx` (`createSessionAdminLoaders`) |

Quy tắc cần nhớ:
- `ui → application → domain`; `infrastructure → application/domain`.
- **Feature không import feature khác.** Cần ghép hai feature thì `app/` làm (ví dụ `MemberHomePage` nhận prop `examScreen`, `router.tsx` truyền `MemberExamPage`). Cần dùng chung thì chuyển sang `shared/` (ví dụ `shared/leaderboard`, `shared/ui/member`).
- Mọi file dưới `src/` phải nằm trong một layer; file lạc layer làm `arch:check` fail, không có allowlist nữa.
- Không tải gì từ CDN/font ngoài; không dùng cú pháp shell chỉ chạy trên POSIX trong npm script (CLAUDE.md, Constraints).

## Bước 5. Tài liệu trong cùng PR

- Có API/contract mới → `architecture.md` §5 (hoặc mục tương ứng).
- Có module/feature mới theo mẫu đáng chú ý → thêm vài dòng ở §11/§12.
- Đổi quy tắc nghiệp vụ → `PRODUCT.md` (đã làm ở Bước 1).
- Câu chữ UI mới là tiếng Việt, code và comment tiếng Anh.

## Bước 6. Checklist trước khi mở PR

```bash
npm test            # gồm cả arch-check test và leak-guard test
npm run typecheck
npm run arch:check  # quy tắc phụ thuộc giữa các layer
```

- [ ] Use case có test với fake; repository có test với DB in-memory; route có integration test.
- [ ] Endpoint member mới: có test không lộ đáp án; `leak-guard` vẫn xanh.
- [ ] Có UI: đã chạy `npm run dev` và thao tác luồng chính trên trình duyệt (desktop và điện thoại nếu là màn member), đã thử F5 giữa chừng.
- [ ] Không có import vượt layer (`arch:check` xanh), không thêm `LEGACY_ALLOWLIST`.
- [ ] Không thêm thư viện ngoài danh sách `architecture.md` §1.
- [ ] Tài liệu đã cập nhật (Bước 5).
