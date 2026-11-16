# Kiến trúc & Contract chung

> Contract mà **mọi story phải tuân theo**. Business rule nằm ở [PRODUCT.md](PRODUCT.md); file này mô tả cách hiện thực.
> Implement thấy contract sai/thiếu → **dừng lại, ghi rõ vấn đề trong báo cáo story**, không tự đổi contract. Đổi contract = sửa file này trong cùng commit và nêu rõ.

## 1. Thư viện đã chốt (không thêm thư viện cùng chức năng)

| Mục đích | Thư viện |
|---|---|
| HTTP server | `fastify` 5, `@fastify/static`, `@fastify/cookie` |
| DB | `better-sqlite3` + `drizzle-orm` (migration bằng `drizzle-kit generate`, chạy migrate lúc server khởi động) |
| Validate input API | `zod` (schema đặt trong `src/shared/api/`, server và web cùng import) |
| Hash mật khẩu | `node:crypto` `scrypt` + `timingSafeEqual` (không thêm bcrypt/argon) |
| Frontend | React 19, `react-router` v7 (library mode, `createBrowserRouter`) |
| CSS | Tailwind CSS v4 qua `@tailwindcss/vite` (bundle offline, không CDN) |
| Render Markdown | `react-markdown` + `remark-gfm` + `rehype-highlight` (highlight.js, CSS theme import local) — chỉ qua component dùng chung `<Markdown>` |
| Test | `vitest`; API test bằng `app.inject()` trên DB `:memory:` |

## 2. Data model

Tên bảng/cột snake_case trong SQLite, camelCase trong Drizzle. Mọi `id` là `integer` autoincrement. Thời gian: `integer` mode `timestamp_ms`. `points` là số nguyên; mọi cột điểm đạt được (`auto_score`, `manual_score`) là `real` (chấm tay cho phép 0.5).

```
exams ──< questions ──< options
  │
  └──< sessions ──< participants ──< attempts ──< answers >── questions
```

| Bảng | Cột | Ghi chú |
|---|---|---|
| `exams` | id, title, description?, source_markdown, total_points, has_essay, created_at | `source_markdown` lưu nguyên file đã import. **Đề bất biến** sau khi tạo (không có API sửa). |
| `questions` | id, exam_id, position, type (`single`\|`multi`\|`essay`), prompt, body, points, explanation? | `position` theo thứ tự trong file. |
| `options` | id, question_id, position, text, is_correct | |
| `sessions` | id, exam_id, mode (`self_paced`\|`live`), status, shuffle (bool, mặc định true), auto_approve (bool, mặc định false), room_code?, created_at, opened_at?, started_at?, closed_at?, finalized_at? | MVP chỉ tạo `self_paced`. `room_code`: 6 chữ số ngẫu nhiên, sinh khi `open`, unique; `null` khi còn `draft`. |
| `participants` | id, session_id, display_name, token (unique), status (`active`\|`pending`\|`kicked`), joined_at | Unique (session_id, lower(display_name)) cho participant chưa bị kick. |
| `attempts` | id, participant_id, attempt_no, question_order (JSON `number[]`), option_order (JSON `Record<questionId, optionId[]>`), started_at, submitted_at?, auto_score?, manual_score? | Thứ tự trộn sinh **lúc tạo attempt**. Mỗi participant có đúng 1 attempt mỗi phiên (`attempt_no` luôn là 1). |
| `answers` | id, attempt_id, question_id, selected_option_ids (JSON `number[]`)?, text_answer?, auto_score?, manual_score?, feedback?, graded_at? | Unique (attempt_id, question_id). Upsert khi autosave. |
| `app_meta` | key, value, updated_at | Đã có. Lưu `admin_password_hash`. |

## 3. State machine phiên thi

Hàm thuần `src/shared/session-state.ts`:

```ts
type SessionStatus = 'draft' | 'lobby' | 'running' | 'closed' | 'finalized';
type SessionAction = 'open' | 'start' | 'close' | 'finalize';
function nextStatus(current: SessionStatus, action: SessionAction): SessionStatus | null; // null = không hợp lệ
```

| Từ | Action | Sang | Điều kiện / tác dụng phụ |
|---|---|---|---|
| draft | open | lobby | Không có phiên nào khác ở `lobby`/`running` (**tối đa 1 phiên hoạt động**). |
| lobby | start | running | |
| running | close | closed | Mọi attempt chưa nộp được **tự nộp** với câu trả lời đã lưu. Nếu đề không có tự luận → tự chuyển tiếp `finalized`. |
| closed | finalize | finalized | Mọi câu tự luận của các attempt được tính đã có `manual_score`. |

## 4. Xác thực

- **Mentor**: lần đầu chạy chưa có `admin_password_hash` → `POST /api/admin/setup` đặt mật khẩu (≥ 6 ký tự). Login → cookie `pq_admin` (httpOnly, sameSite=lax) chứa token ngẫu nhiên; token lưu trong `Map` bộ nhớ (restart server = login lại — chấp nhận). Hook `requireMentor` cho mọi route `/api/admin/*` trừ `setup`, `login`, `status`. Trước cả hook đó, `requireLocal` chặn (403) mọi request `/api/admin/*` không đến từ máy chạy app (loopback hoặc IP của chính các interface của máy); `--allow-remote-admin` / `ALLOW_REMOTE_ADMIN=1` tắt chặn này. IP lấy từ socket; `X-Forwarded-For` chỉ được tin khi peer là loopback (proxy dev của Vite, cấu hình `xfwd`).
- **Member**: join cần **mã phòng** của phiên (`room_code`, PRODUCT.md §7.16), kiểm trên server, so sánh hằng-thời-gian và giới hạn số lần sai theo IP. Join trả về `token` (32 byte ngẫu nhiên, base64url). Web lưu ở `localStorage` key `pq:participant:<sessionId>`, gửi qua header `X-Participant-Token`. Hook `requireParticipant` cho `/api/me/*`; participant `kicked` → 403.

## 5. API

Mọi body/response là JSON. Lỗi: `{ error: string }` (tiếng Việt, hiển thị được cho người dùng) với status 400/401/403/404/409. Schema zod và type response đặt ở `src/shared/api/<nhóm>.ts`.

### Mentor — `/api/admin`
| Method | Path | Mô tả |
|---|---|---|
| GET | `/status` | `{ setupDone: boolean, loggedIn: boolean }` |
| POST | `/setup` | `{ password }` — chỉ khi chưa setup, rồi login luôn |
| POST | `/login` / `/logout` | |
| POST | `/exams/preview` | `{ markdown }` → `ParseResult` (không lưu) |
| POST | `/exams` | `{ markdown }` → parse lại phía server; có lỗi → 400 kèm `errors`; ok → tạo exam |
| GET | `/exams` · `/exams/:id` | list (không kèm câu hỏi) · chi tiết đầy đủ kèm đáp án |
| DELETE | `/exams/:id` | Chỉ khi chưa có session nào dùng → ngược lại 409 |
| POST | `/sessions` | `{ examId, shuffle?, autoApprove? }` → session `draft` |
| GET | `/sessions` · `/sessions/:id` | list (mới nhất trước) · chi tiết kèm participants, mỗi người có `progress { state: none\|doing\|submitted, attempts, countedScore, maxScore, submittedAt }` (`submittedAt` = epoch ms lúc nộp lượt được tính, `null` khi chưa nộp; dùng cho chuông thông báo) |
| POST | `/sessions/:id/{open,start,close,finalize}` | Chuyển trạng thái theo §3; sai → 409 |
| PATCH | `/participants/:id` | `{ displayName }` đổi tên |
| POST | `/participants/:id/{kick,approve}` | |
| GET | `/sessions/:id/grading` | Câu tự luận + bài làm của các attempt được tính, nhóm theo câu |
| GET | `/sessions/:id/discussion` | Chế độ thảo luận (S17). Chỉ khi `closed`/`finalized` (khác → 409). Trả `examTitle`, `submitted`, tiến độ chấm `graded/total`. Mỗi câu theo `position`: nội dung, lời giải, options kèm `isCorrect` và **số người chọn**; thống kê đúng/sai/bỏ trống; câu tự luận: các bài **ẩn danh** `{ answerId, label: "Bài #k", textAnswer, manualScore, feedback }` theo thứ tự trộn cố định. **Không** trả `displayName`/`participantId`. Chấm điểm dùng `PUT /answers/:id/grade` |
| GET | `/participants/:id/review` | Bài làm của một người trong phiên (lượt duy nhất): từng câu theo thứ tự họ thấy, lựa chọn của họ, đáp án đúng, giải thích, điểm. Xem được ở mọi trạng thái phiên (chỉ mentor). `{ participant, state, attempt: ReviewView \| null }` |
| PUT | `/answers/:id/grade` | `{ score, feedback? }`, 0 ≤ score ≤ points; chỉ khi session `closed` |

### Công khai / member
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/sessions/active` | — | Phiên đang `lobby`/`running` (id, title, status) hoặc `null` |
| GET | `/api/sessions/latest` | — | Như `active`, nhưng khi không có phiên hoạt động thì trả phiên `closed`/`finalized` gần nhất (cho màn hình chiếu); `null` nếu chưa có |
| GET | `/api/network` | — | `{ joinHosts: string[] }` — địa chỉ LAN `ip:cổng` để member gõ vào trình duyệt (cổng lấy từ Host của request) |
| POST | `/api/sessions/:id/join` | — | `{ displayName, roomCode }` → `{ token, participant }`. Mã sai → 403, sai quá 5 lần/phút từ một IP → 429. Mặc định → `pending` (mentor duyệt, cả ở lobby); phiên có `autoApprove` → `active` ngay; trùng tên → 409 |
| GET | `/api/screen/room` | chỉ máy mentor (không tính `--allow-remote-admin`) | `{ roomCode: string \| null }` của phiên `lobby`/`running` — cho màn hình chiếu. Không bao giờ trả mã qua endpoint công khai |
| GET | `/api/sessions/:id/participants` | — | Chỉ `{ displayName }[]` của participant `active` (cho màn hình chiếu) |
| GET | `/api/sessions/:id/leaderboard` | — | Xem §6 |
| GET | `/api/sessions/:id/events` | — | SSE, xem §7 |
| GET | `/api/me` | participant | participant + session (id, title, status, `participantCount` = số người `active`, `questionCount`, `totalPoints`, `hasEssay`) + `attempt: { current, submitted[], canStartNew }` (lượt đang làm, lượt đã nộp với điểm tự động `score/maxScore` và `essayScore` = tổng điểm tự luận đã chấm hoặc `null`, `canStartNew` = chưa có lượt nào và phiên đang `running`) |
| POST | `/api/me/attempts` | participant | Bắt đầu lượt. Cần session `running`, participant `active`; mỗi participant chỉ có 1 lượt/phiên (đã có lượt → 409) |
| GET | `/api/me/attempts/:id` | participant | Câu hỏi theo thứ tự đã trộn + câu trả lời đã lưu |
| PUT | `/api/me/attempts/:id/answers/:questionId` | participant | `{ selectedOptionIds }` hoặc `{ textAnswer }` — autosave |
| POST | `/api/me/attempts/:id/submit` | participant | Nộp, chấm tự động, trả về điểm |
| GET | `/api/me/attempts/:id/review` | participant | Chỉ khi session `closed`/`finalized`: đáp án đúng, giải thích, điểm, nhận xét |

### ⚠️ Quy tắc không lộ đáp án (bắt buộc có test)
Trước khi session `closed`, **không response nào gửi cho member** được chứa `is_correct`, `explanation`, hay điểm từng câu. Dùng type DTO riêng cho member (`MemberQuestion`, `MemberOption`) — không trả thẳng row DB. Chỉ `GET /api/me/attempts/:id/review` được mang đáp án, và trả 403 cho tới khi session `closed`/`finalized`.

Phòng thủ nhiều lớp:
1. **DTO dựng từng trường** + test quét đệ quy key `isCorrect`/`is_correct`/`explanation` trên mọi response `/api/me/*`.
2. **Chốt chặn `src/server/leak-guard.ts`** (hook `onSend` toàn cục): response JSON nào ngoài `/api/admin/*` và route review mà chứa các key đó sẽ bị thay bằng 500 và ghi log — bắt lỗi trả nhầm row DB trong tương lai.
3. **`/api/admin/*` chỉ mở trên máy mentor** (§4), nên member không đọc được đề qua API mentor.
4. **Vite dev server** (`npm run dev`) mở ra LAN và mặc định phục vụ mọi file trong repo qua `/@fs/` (gồm `exams/`, `data/`). `vite.config.ts` đặt `server.fs.allow` chỉ gồm `src/web`, `src/shared`, `node_modules` và `deny` cho `exams/`, `data/`, `docs/`, `*.db`. Không nới lỏng mục này.

## 6. Chấm điểm & xếp hạng

Hàm thuần trong `src/shared/scoring.ts`:
- `scoreAnswer(question, selectedOptionIds)`: single/multi — tập chọn **bằng đúng** tập đúng → `points`, ngược lại 0. Essay → `null` (chờ chấm tay).
- **Attempt được tính** của một participant: attempt duy nhất của họ trong phiên (đã nộp).
- **Leaderboard**: participant `active` có ≥ 1 attempt đã nộp; điểm = auto + manual của attempt được tính; sắp giảm dần theo điểm, bằng điểm → `submitted_at` sớm hơn xếp trên. Response: `{ provisional: boolean, entries: { rank, displayName, score, maxScore, submittedAt }[] }`, `provisional = status !== 'finalized'`.

## 7. Realtime (SSE)

- Event bus trong process: `src/server/events.ts` — `publish(sessionId, type)`, `subscribe(sessionId, listener)`.
- `GET /api/sessions/:id/events` → `text/event-stream`, gửi `event: <type>\ndata: {}\n\n`; heartbeat comment mỗi 20s.
- Event types: `session` (đổi status), `participants` (join/kick/rename/approve), `leaderboard` (có bài nộp/chấm điểm).
- **Event chỉ là tín hiệu "có thay đổi"** — client nhận event thì gọi lại API REST tương ứng. Không đẩy dữ liệu qua SSE (tránh lộ đáp án, đơn giản hoá).
- Web: hook `useSessionEvents(sessionId, handlers)` dùng `EventSource`, tự kết nối lại. **Mỗi tab chỉ mở 1 `EventSource` cho mỗi phiên**, dùng chung cho mọi component (đếm người đăng ký, người cuối rời thì đóng): mỗi `EventSource` giữ một kết nối HTTP/1.1 và trình duyệt chỉ cho 6 kết nối/địa chỉ, mở thừa sẽ làm treo mọi request khác. Không tạo `EventSource` trực tiếp ngoài hook này.

## 8. Frontend routes

| Route | Ai | Màn hình |
|---|---|---|
| `/` | member | Vào phiên đang hoạt động (nhập tên) → phòng chờ → làm bài → kết quả/xếp hạng → xem lại |
| `/screen` | máy chiếu | Màn hình chiếu của phiên đang hoạt động (hoặc phiên gần nhất) |
| `/admin/login` | mentor | Setup lần đầu / đăng nhập |
| `/admin/exams` · `/admin/exams/import` · `/admin/exams/:id` | mentor | Danh sách đề · import + preview · chi tiết đề |
| `/admin/sessions` · `/admin/sessions/:id` | mentor | Lịch sử phiên · điều khiển phiên (lobby, tiến độ, đóng) |
| `/admin/sessions/:id/grading` | mentor | Chấm tự luận |
| `/admin/sessions/:id/review` | mentor | Xem lại phiên: ai tham gia, bài từng người |
| `/admin/sessions/:id/discuss` | mentor | Chế độ thảo luận: chiếu từng câu, chấm tự luận cùng lớp (S17) |

Chuông thông báo mentor (PRODUCT.md §7.20) nằm trong khung `/admin/*`: `useMentorNotices` lấy `/api/sessions/active`, rồi `/api/admin/sessions/:id` + SSE của phiên đó; danh sách dựng bằng hàm thuần `src/web/lib/mentor-notices.ts` từ `joinedAt`/`progress.submittedAt`; mốc đã xem ở `localStorage` key `pq:mentor:notices-seen:<sessionId>`. Thông báo desktop: `useDesktopNotify` (Notification API, cần secure context nên chỉ chạy trên `localhost`), lựa chọn bật/tắt ở `localStorage` key `pq:mentor:desktop-notify`, `tag` theo participant để nhiều tab không hiện trùng. Không có API hay event mới.

Gọi API qua `src/web/lib/api.ts` (wrapper `fetch`, tự gắn token member, ném lỗi có `message` từ `{ error }`). UI text tiếng Việt.

## 9. Layering (Clean Architecture)

> Đích của epic #7. Code cũ (`routes/`, `services/`, `src/web/pages`, `src/web/lib`) đang được chuyển dần từng module; phần chưa chuyển được miễn tạm trong allowlist của `arch:check` (xem §9.7). Refactor **không đổi hành vi nghiệp vụ và không đổi §1-§8**.

### 9.1 Sơ đồ thư mục đích

```
src/server/
  domain/                 # entity, value object, policy. TS thuần
  application/
    ports/                # interface async: XxxRepository, UnitOfWork, EventPublisher, Clock, TokenGenerator
    use-cases/<module>/   # 1 file = 1 use case, tên là động từ
  infrastructure/
    db/                   # schema Drizzle, DrizzleXxxRepository, UnitOfWork
    events/               # SSE bus (implement EventPublisher)
  interface/http/         # route Fastify, parse zod, presenter entity -> DTO, plugin auth
  composition.ts          # composition root: nối tay, không DI container

src/web/
  features/<feature>/
    domain/               # model thuần, quy tắc
    application/          # use case dạng hook/reducer; port: ApiGateway, TokenStore, EventStream
    infrastructure/       # fetch, localStorage, EventSource
    ui/                   # page + component: chỉ render và gọi application
  shared/                 # ui kit, hook hạ tầng, api-client lõi
  app/                    # router, layout, composition

src/shared/               # DTO, zod schema, hàm thuần mà cả web và server cùng cần
```

### 9.2 Quy tắc phụ thuộc (một chiều)

Backend: `interface -> application -> domain`; `infrastructure -> application, domain`.

| Layer | Được import | **Cấm** import |
|---|---|---|
| `domain` | `domain`, `src/shared` | `application`, `infrastructure`, `interface`, `fastify`, `drizzle-orm`, `better-sqlite3` |
| `application` | `domain`, `application`, `src/shared` | `infrastructure`, `interface`, `fastify`, `drizzle-orm`, `better-sqlite3` |
| `infrastructure` | `application`, `domain`, `src/shared`, thư viện hạ tầng | `interface` |
| `interface` | `application`, `domain`, `src/shared`, `fastify` | `infrastructure` (ngoại lệ duy nhất: `composition.ts`) |

Frontend (trong một feature): `ui -> application -> domain`; `infrastructure -> application, domain`.
- `domain` không import `react`.
- `ui` không import `infrastructure` (nhận implementation qua composition/context).
- Feature này không import nội bộ feature khác; muốn dùng chung thì đưa vào `shared/`.

`src/shared/` không import Node hay DOM API (quy tắc có sẵn) và không import `src/server`, `src/web`.

### 9.3 Quyết định: port async

Mọi port trong `application/ports` trả `Promise`, kể cả khi hiện thực bằng `better-sqlite3` (đồng bộ). Lý do: use case không được phụ thuộc đặc thù của `better-sqlite3`; đổi DB hay thêm I/O (file, mạng) sau này không phải sửa use case.

Hệ quả: `db.transaction()` của Drizzle chỉ nhận callback đồng bộ nên không dùng được cho use case async. Cần `UnitOfWork.run(async ctx => ...)` tự `BEGIN`/`COMMIT`/`ROLLBACK` và tuần tự hóa các unit of work trên SQLite. Thiết kế đã được chứng minh ở spike P0-3 (issue #10): xem ADR §10. Kết luận là khả thi gọn nên giữ port async.

### 9.4 Quy ước đặt tên

| Loại | Quy ước | Ví dụ |
|---|---|---|
| Use case | Động từ, 1 file/1 use case | `StartAttempt`, `ImportExam` |
| Port repository | `XxxRepository` | `ExamRepository` |
| Implementation Drizzle | `DrizzleXxxRepository` | `DrizzleExamRepository` |
| Fake cho test | `InMemoryXxxRepository` | `InMemoryExamRepository` |
| Port khác | Danh từ chỉ vai trò | `UnitOfWork`, `EventPublisher`, `Clock`, `TokenGenerator` |

### 9.5 Ranh giới `src/shared/` và `domain/`

- `src/shared/`: thứ **cả web và server** cùng cần: DTO và schema zod (`api/`), hàm thuần dùng chung (`scoring.ts`, `session-state.ts`, `exam-format/`).
- `domain/` (server): entity, policy **chỉ server** cần (ví dụ quy tắc sinh mã phòng, trộn thứ tự). Có thể import `src/shared`, không ngược lại.
- Không chắc: bắt đầu ở `domain/`; chỉ chuyển sang `src/shared/` khi web thực sự cần.

### 9.6 Quy tắc test

- Use case: test bằng fake in-memory (`InMemoryXxxRepository`, `Clock`/`TokenGenerator` giả), không cần Fastify hay DB.
- Route: giữ `app.inject()` trên `createDb(':memory:')` làm integration test; test không lộ đáp án (§5) và `leak-guard` giữ nguyên.
- Quy tắc phụ thuộc §9.2 kiểm bằng `npm run arch:check` (P0-2), chạy cả trong `npm test`.

### 9.7 Kiểm tra tự động: `npm run arch:check`

- Script tự viết (không thêm thư viện, nên §1 không đổi): `scripts/arch-check.ts` + `scripts/arch/{rules,check,allowlist}.ts`. Quét import (tĩnh, re-export, `import()`) của mọi `.ts/.tsx` trong `src/` và đối chiếu với bảng ở §9.2. Chạy được trên mọi OS; `scripts/arch/check.test.ts` chạy trong `npm test` nên vi phạm làm test đỏ.
- Mọi file dưới `src/` phải nằm trong một layer (đường dẫn theo §9.1) **hoặc** trong allowlist legacy. File mới ngoài layer mà không có trong allowlist sẽ fail: không viết thêm code kiểu cũ.
- **Allowlist** nằm ở một file duy nhất `scripts/arch/allowlist.ts` (entry kết thúc bằng `/` là cả thư mục). Khi chuyển xong một module, xóa phần của nó khỏi allowlist trong cùng PR. Entry không còn khớp file nào cũng làm `arch:check` fail, nên danh sách chỉ co lại. Mục tiêu cuối: rỗng.
- Thêm/sửa luật: sửa `scripts/arch/rules.ts` và thêm test fixture tương ứng.

## 10. ADR: `UnitOfWork` async trên better-sqlite3

**Trạng thái:** chấp nhận (spike P0-3, issue #10). Code: `application/ports/unit-of-work.ts`, `infrastructure/db/sqlite-database.ts`, test `sqlite-unit-of-work.test.ts`.

**Vấn đề.** `better-sqlite3` đồng bộ và `db.transaction()` của Drizzle chỉ nhận callback đồng bộ, nên không dùng được cho use case async (§9.3). Nếu mở `BEGIN` thủ công rồi `await`, event loop quay: request khác trên **cùng kết nối** sẽ ghi vào transaction đang mở hoặc đọc dòng chưa commit (test `why a gate is needed` tái hiện dirty read).

**Hai hướng đã so sánh**

| | A: một kết nối + mutex cho mọi truy cập | B: hai kết nối WAL (ghi / đọc), ghi tuần tự bằng mutex |
|---|---|---|
| Đọc không thấy dữ liệu chưa commit | Có, vì đọc phải chờ mutex | Có, nhờ WAL (test chứng minh) |
| Chạy với DB `:memory:` của test | **Có** | **Không**: `:memory:` không chia sẻ giữa hai kết nối và better-sqlite3 không hiểu URI `file:...?cache=shared`. Test phải dùng file tạm |
| Code cũ (`app.db` đồng bộ) | Dùng nguyên | Phải quyết định code cũ dùng kết nối nào |
| Độ phức tạp | Một mutex + `AsyncLocalStorage` | Hai kết nối, vòng đời, đọc có thể thấy snapshot cũ |
| Đọc song song khi đang ghi | Không (chờ) | Có |

**Quyết định: hướng A.** Lý do: giữ được integration test `:memory:` (§9.6), ít bộ phận hơn, và lợi ích duy nhất của B (đọc song song khi có transaction) không cần ở quy mô một mentor + vài chục member trên LAN.

**Thiết kế**
- `SqliteDatabase.read(fn)`: lấy mutex FIFO rồi chạy `fn(db)`. `SqliteDatabase.transaction(fn)`: giữ mutex suốt `BEGIN IMMEDIATE` … `COMMIT`, `ROLLBACK` khi lỗi (kể cả khi `COMMIT` thất bại).
- Bên trong một unit, `read()` nhận ra unit đang mở bằng `AsyncLocalStorage` và chạy thẳng trên kết nối đó (thấy đúng ghi của chính unit, không tự deadlock). Cờ `active` tắt khi unit kết thúc, nên promise "bắn rồi quên" sống lâu hơn unit không lách được mutex.
- `UnitOfWork<Ctx>.run(fn)` là port; `SqliteUnitOfWork` dựng `Ctx` (các repository giao dịch) trên kết nối của unit. Unit lồng nhau ném `NestedUnitOfWorkError` ngay (không deadlock).

**Giới hạn và quy tắc cho P1-1 trở đi**
1. Trong callback của unit **chỉ `await` thứ resolve bằng microtask** (repository, `Clock`, `TokenGenerator`). Không await timer, mạng, file: unit giữ cả DB trong lúc đó và mọi request khác phải chờ.
2. Mọi truy cập đọc của code mới đi qua `SqliteDatabase.read()` (hoặc `ctx` trong unit).
3. **Giai đoạn chuyển tiếp:** code cũ vẫn gọi `app.db` đồng bộ, không qua mutex. An toàn miễn là quy tắc 1 được giữ: handler cũ chỉ chạy được khi event loop quay, mà unit không để event loop quay. Nếu vi phạm, code cũ gọi `db.transaction()` sẽ bị SQLite báo lỗi rõ ràng (không lồng transaction) còn đọc cũ có thể thấy dữ liệu chưa commit. Hết giai đoạn chuyển tiếp (P3-5) thì mọi truy cập đi qua `SqliteDatabase`.
4. Một process, một kết nối: không chạy hai instance server trên cùng file DB (đã là giả định của sản phẩm).

**Đo sơ bộ** (`npx tsx scripts/bench-uow.ts`, 100k lần, Node 22, `:memory:`, một query `SELECT ... WHERE key = ?`; 3 lần chạy): đọc đồng bộ trực tiếp 37.7-38.6 µs/lần, qua `read()` 37.2-40.4 µs/lần, 50 đọc đồng thời qua mutex 38.6-41.0 µs/lần. Chênh lệch nằm trong nhiễu đo. Đây là micro-benchmark một query, **chưa phải** `GET /api/me` thật (nhiều query + HTTP); so sánh trước/sau trên endpoint thật chỉ làm được khi một route chuyển sang `SqliteDatabase` (P1-1 trở đi).
