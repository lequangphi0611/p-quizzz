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
2. **Chốt chặn `src/server/interface/http/leak-guard.ts`** (hook `onSend` toàn cục): response JSON nào ngoài `/api/admin/*` và route review mà chứa các key đó sẽ bị thay bằng 500 và ghi log — bắt lỗi trả nhầm row DB trong tương lai.
3. **`/api/admin/*` chỉ mở trên máy mentor** (§4), nên member không đọc được đề qua API mentor.
4. **Vite dev server** (`npm run dev`) mở ra LAN và mặc định phục vụ mọi file trong repo qua `/@fs/` (gồm `exams/`, `data/`). `vite.config.ts` đặt `server.fs.allow` chỉ gồm `src/web`, `src/shared`, `node_modules` và `deny` cho `exams/`, `data/`, `docs/`, `*.db`. Không nới lỏng mục này.

## 6. Chấm điểm & xếp hạng

Hàm thuần trong `src/shared/scoring.ts`:
- `scoreAnswer(question, selectedOptionIds)`: single/multi — tập chọn **bằng đúng** tập đúng → `points`, ngược lại 0. Essay → `null` (chờ chấm tay).
- **Attempt được tính** của một participant: attempt duy nhất của họ trong phiên (đã nộp).
- **Leaderboard**: participant `active` có ≥ 1 attempt đã nộp; điểm = auto + manual của attempt được tính; sắp giảm dần theo điểm, bằng điểm → `submitted_at` sớm hơn xếp trên. Response: `{ provisional: boolean, entries: { rank, displayName, score, maxScore, submittedAt }[] }`, `provisional = status !== 'finalized'`.

## 7. Realtime (SSE)

- Event bus trong process: `src/server/infrastructure/events/event-bus.ts` — `publish(sessionId, type)`, `subscribe(sessionId, listener)` (use case phát qua port `EventPublisher`, SSE nghe qua `EventSubscriber`).
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

> Đích của epic #7. Backend đã chuyển xong (P3-5); code cũ phía web (`src/web/pages`, `src/web/lib`, ...) đang được chuyển dần từng feature; phần chưa chuyển được miễn tạm trong allowlist của `arch:check` (xem §9.7). Refactor **không đổi hành vi nghiệp vụ và không đổi §1-§8**.

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
    system/               # SystemClock, SecureTokenGenerator, CryptoRandom
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

Mọi port **có I/O** trong `application/ports` (`XxxRepository`, `UnitOfWork`, `EventPublisher`) trả `Promise`, kể cả khi hiện thực bằng `better-sqlite3` (đồng bộ). Ngoại lệ: `Clock`, `TokenGenerator`, `Random` là tính toán cục bộ, không I/O, nên đồng bộ (và `shuffled` cần callback đồng bộ). Lý do: use case không được phụ thuộc đặc thù của `better-sqlite3`; đổi DB hay thêm I/O (file, mạng) sau này không phải sửa use case.

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
- Đã áp dụng (P2-1): `session-state.ts` và `scoring.ts` **ở lại `shared/`** vì web import (nhãn trạng thái, `session-ui.ts`). `shuffled` (Fisher–Yates) và `randomRoomCode` chỉ server cần nên chuyển vào `domain/` (`domain/shuffle.ts`, `domain/session/room-code.ts`); chúng nhận hàm ngẫu nhiên từ ngoài, không tự gọi `crypto`.

### 9.6 Quy tắc test

- Use case: test bằng fake in-memory (`InMemoryXxxRepository`, `Clock`/`TokenGenerator` giả), không cần Fastify hay DB.
- Route: giữ `app.inject()` trên `createDb(':memory:')` làm integration test; test không lộ đáp án (§5) và `leak-guard` giữ nguyên.
- Quy tắc phụ thuộc §9.2 kiểm bằng `npm run arch:check` (P0-2), chạy cả trong `npm test`.

### 9.7 Kiểm tra tự động: `npm run arch:check`

- Script tự viết (không thêm thư viện, nên §1 không đổi): `scripts/arch-check.ts` + `scripts/arch/{rules,check,allowlist}.ts`. Quét import (tĩnh, re-export, `import()`) của mọi `.ts/.tsx` trong `src/` và đối chiếu với bảng ở §9.2. Chạy được trên mọi OS; `scripts/arch/check.test.ts` chạy trong `npm test` nên vi phạm làm test đỏ.
- Mọi file dưới `src/` phải nằm trong một layer (đường dẫn theo §9.1) **hoặc** trong allowlist legacy. File mới ngoài layer mà không có trong allowlist sẽ fail: không viết thêm code kiểu cũ.
- **Allowlist** nằm ở một file duy nhất `scripts/arch/allowlist.ts` (entry kết thúc bằng `/` là cả thư mục). Khi chuyển xong một module, xóa phần của nó khỏi allowlist trong cùng PR. Entry không còn khớp file nào cũng làm `arch:check` fail, nên danh sách chỉ co lại. Mục tiêu cuối: rỗng.
- Thêm/sửa luật: sửa `scripts/arch/rules.ts` và thêm test fixture tương ứng.
- **Vỏ lắp ráp (P3-5):** `composition.ts`, `app.ts`, `index.ts`, `config.ts`, `app.test.ts` và `src/server/test/` (helper dựng cả app, test tích hợp HTTP ở `test/integration/`) thuộc layer `server/composition`: chỉ những file này được thấy mọi layer. Backend không còn entry nào trong allowlist; allowlist chỉ còn code web.

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
3. **Giai đoạn chuyển tiếp (đã kết thúc ở P3-5, mọi truy cập DB của code chạy thật đi qua `SqliteDatabase`; `app.db` chỉ còn để harness test đọc dữ liệu dựng kịch bản):** code cũ gọi `app.db` đồng bộ, không qua mutex. An toàn miễn là quy tắc 1 được giữ: handler cũ chỉ chạy được khi event loop quay, mà unit không để event loop quay. Nếu vi phạm, code cũ gọi `db.transaction()` sẽ bị SQLite báo lỗi rõ ràng (không lồng transaction) còn đọc cũ có thể thấy dữ liệu chưa commit. Hết giai đoạn chuyển tiếp (P3-5) thì mọi truy cập đi qua `SqliteDatabase`.
4. Một process, một kết nối: không chạy hai instance server trên cùng file DB (đã là giả định của sản phẩm).

**Đo sơ bộ** (`npx tsx scripts/bench-uow.ts`, 100k lần, Node 22, `:memory:`, một query `SELECT ... WHERE key = ?`; 3 lần chạy): đọc đồng bộ trực tiếp 37.7-38.6 µs/lần, qua `read()` 37.2-40.4 µs/lần, 50 đọc đồng thời qua mutex 38.6-41.0 µs/lần. Chênh lệch nằm trong nhiễu đo. Đây là micro-benchmark một query, **chưa phải** `GET /api/me` thật (nhiều query + HTTP); so sánh trước/sau trên endpoint thật chỉ làm được khi một route chuyển sang `SqliteDatabase` (P1-1 trở đi).

## 11. Module mẫu: `exams` (P1-1, issue #11)

Module đầu tiên đã chuyển sang Clean Architecture. Module sau bắt chước cấu trúc này. Hành vi và API không đổi (§1-§5).

| File | Vai trò |
|---|---|
| `domain/errors.ts` | `DomainError` với `kind` (`not_found`, `conflict`, `invalid`, `forbidden`): lỗi nghiệp vụ không biết HTTP |
| `domain/exam/exam.ts` | Entity `Exam`/`Question`/`Option` (TS thuần) và `newExam()` tính `totalPoints`, `hasEssay`, đánh số `position` |
| `domain/exam/errors.ts` | `ExamNotFoundError`, `ExamInUseError` (message tiếng Việt cho người dùng) |
| `application/ports/exam-repository.ts` | Port: `ExamReader` (đọc, dùng riêng được), `ExamRepository` (thêm `add`/`remove`, chỉ tới được qua `ExamUnitContext` trong `UnitOfWork`), kiểu `ExamSummary` (kèm `questionCount`, `sessionCount`) |
| `application/use-cases/exams/*.ts` | 1 file = 1 use case: `PreviewExam`, `ImportExam`, `ListExams`, `GetExam`, `DeleteExam`; `errors.ts` có `InvalidExamError` (mang danh sách lỗi parser) |
| `application/testing/in-memory-exam-repository.ts` | Fake `InMemoryExamRepository` + `InMemoryExamUnitOfWork` (rollback bằng snapshot) cho test use case |
| `infrastructure/db/drizzle-exam-repository.ts` | `DrizzleExamRepository`: nhận một hàm truy cập `(fn) => Promise`; ngoài unit là `SqliteDatabase.read`, trong unit là kết nối của unit |
| `interface/http/exams-routes.ts` | Chỉ parse zod, gọi một use case, trả presenter; `InvalidExamError` thành 400 kèm `errors` |
| `interface/http/presenters/exam-presenter.ts` | Entity/`ExamSummary` thành DTO của `src/shared/api` (`Date` thành epoch ms) |
| `interface/http/domain-errors.ts` | `DomainError.kind` thành status (400/403/404/409); lỗi khác ném lại (500) |
| `composition.ts` | `compose(db)`: dựng `SqliteDatabase`, repository, `SqliteUnitOfWork`, use case; `buildApp()` nhận `Composition` (mặc định `compose(db)`) |

Quy ước rút ra:
- Ghi nhiều bảng: đi qua `UnitOfWork.run`, repository ghi không tự mở transaction. Kiểm tra rồi ghi (ví dụ `DeleteExam`: đếm session rồi xóa) cũng nằm trong một unit để không bị chen ngang.
- Test: use case bằng fake in-memory (`exams.test.ts`), repository bằng `createDb(':memory:')` (`drizzle-exam-repository.test.ts`), HTTP bằng `routes/exams.test.ts` (không đổi, trừ test transaction đã chuyển sang test repository).
- Tạm thời `ImportExam` nhận `now: () => Date`; P2-1 thay bằng port `Clock`.
- `infrastructure` còn import `db/schema.ts` và `db/client.ts` cũ (legacy); chuyển vào `infrastructure/db/` ở P3-5.

### 11.1 Port dùng chung (P2-1, issue #12)

| Port | Impl (`infrastructure/`) | Fake (`application/testing/fakes.ts`) | Ghi chú |
|---|---|---|---|
| `Clock.now()` | `system/SystemClock` | `FakeClock` (`advance`, `set`) | `ImportExam` đã dùng |
| `TokenGenerator.generate()` | `system/SecureTokenGenerator` (32 byte base64url, như token member hiện tại) | `FakeTokenGenerator` (`token-1`, ...) | cho `participants` (P3-2) |
| `Random.int(max)` | `system/CryptoRandom` | `FakeRandom` (phát lại dãy số) | dùng với `domain/shuffle`, `randomRoomCode` |
| `EventPublisher.publish(sessionId, type)` | `events/BusEventPublisher` (bọc đúng `bus` toàn cục mà SSE đang subscribe) | `RecordingEventPublisher` | publish **sau** commit, không trong unit. Phase 2 đổi sang WebSocket bằng cách thay impl |

`compose(db, overrides?)` dựng các port này (`SharedPorts`); test truyền fake qua `overrides`.

Code cũ còn dùng trực tiếp (để P3-x xử lý khi chuyển module): `publish` toàn cục ở `services/{sessions,participants,attempts,grading}.ts` (13 chỗ); `new Date()` ở `services/*` và `auth/mentor.ts`; `randomBytes` ở `services/participants.ts` (token member) và `auth/mentor.ts` (salt, token mentor); `randomInt` truyền tay vào `shuffled`/`newRoomCode` ở `services/attempts.ts`, `services/room-code.ts`.

### 11.2 Module `sessions` (P3-1, issue #13)

- `domain/session/`: `Session`, `lifecycle.ts` (`assertTransition`, `planOpen/Start/Close/Finalize`: quy tắc chuyển trạng thái, thuần), `mode.ts` (strategy `SessionMode`: `SelfPacedMode`; `live` của phase 2 chỉ cần viết thêm một `SessionMode` và đăng ký vào `SessionModeRegistry`, không sửa use case), `room-code.ts`, `errors.ts` (đều là `DomainError`).
- `application/use-cases/sessions/`: `CreateSession`, `ListSessions`, `GetSessionDetail`, `GetActiveSession`, `GetLatestSession`, `OpenSession`, `StartSession`, `CloseSession`, `FinalizeSession` (bốn use case cuối gọi chung `transition-session.ts`: toàn bộ kiểm tra + đổi trạng thái là một unit, sự kiện phát sau commit).
- Port đọc/ghi: `SessionRepository` (chỉ trong unit), `SessionReader` (view cho màn hình mentor).
- **Cầu nối tới module chưa chuyển** (`application/ports/session-repository.ts`): `AttemptAutoSubmitter` (nộp bài dở khi `close`) và `UngradedEssayCounter` (đếm tự luận chưa chấm khi `finalize`). Adapter `LegacyAttemptAutoSubmitter`/`LegacyUngradedEssayCounter` ở `infrastructure/db/drizzle-session-repository.ts` bọc `services/attempts.ts`, `services/grading.ts`. P3-3 và P3-4 thay bằng use case thật rồi xóa adapter. `DrizzleSessionReader.findDetail` cũng còn gọi `getSessionProgress` của attempts và đọc bảng `participants` trực tiếp, đổi ở P3-2/P3-3.
- Mã phòng: `application/use-cases/sessions/new-room-code.ts` (thử lại khi trùng) thay `services/room-code.ts`.
- Kiểu `Tx`/`DbOrTx` chuyển sang `db/client.ts` (trước nằm ở `services/sessions.ts`).

### 11.3 Module `participants` + auth (P3-2, issue #14)

- `domain/participant/`: `Participant`, quy tắc thuần (`assertNameFree`, `assertCanJoin` kiểm trạng thái phòng **trước** mã phòng, `statusOnJoin`, `assertListEditable`, `assertApprovable`), lỗi. `domain/session/room-code.ts` thêm `roomCodeMatches` (so sánh hằng-thời-gian). `domain/auth/errors.ts`. `DomainErrorKind` thêm `unauthenticated` (401).
- Use case `participants/`: `JoinSession`, `RenameParticipant`, `KickParticipant`, `ApproveParticipant`, `ListPublicParticipants`, và `ResumeParticipant` (token của member → người tham gia: 401 nếu lạ, 403 nếu bị mời ra; dùng cho hook `/api/me`). `admin/admin-use-cases.ts`: `GetAdminStatus`, `SetupAdmin`, `LoginAdmin`, `LogoutAdmin`, `AuthenticateAdmin`.
- Port: `ParticipantRepository`/`ParticipantReader`, `PasswordHasher`, `AdminCredentialStore`, `AdminSessionStore` (token mentor trong bộ nhớ). Impl: `DrizzleParticipantRepository` (chỉ chỗ này biết chỉ mục `participants_session_name_uq`), `DrizzleAdminCredentialStore` (`app_meta`, `saveIfAbsent` là INSERT nguyên tử), `ScryptPasswordHasher`, `InMemoryAdminSessionStore`.
- `interface/http/auth/`: `require-local.ts`, `mentor-auth.ts` (`requireMentor`, cookie `pq_admin`), `participant-auth.ts` (`requireParticipant`, header `X-Participant-Token`): adapter mỏng gọi use case.
- **`join-limiter` đặt ở `interface/http/join-limiter.ts`, không ở `application`**: khóa giới hạn là địa chỉ client (`req.ip`), thuần khái niệm HTTP, và phải chặn (429) trước cả kiểm tra id và body, nên không thể nằm trong use case mà giữ nguyên thứ tự phản hồi. Route đếm lần sai khi bắt `WrongRoomCodeError`.
- Còn legacy trong `routes/participants.ts` (đi cùng attempts, P3-3): `meRoutes(resume)` (`/api/me` + `attemptRoutes`) và `participantReviewRoutes`.

### 11.4 Module `attempts` (P3-3, issue #15)

- `domain/attempt/`: `Attempt`, `Answer`, và quy tắc thuần trong `attempt.ts`: `assertCanStart` (một attempt/member/phiên), `planOrder` (trộn câu và đáp án bằng `RandomInt` truyền vào), `assertCanWork`, `validateAnswer` (400), `gradeAttempt` (chấm mọi câu, kể cả bỏ trống; tự luận `null`), `assertReviewable` (đáp án từ `closed`), `reviewState`, `memberAttemptState`, `computeProgress`/`NO_PROGRESS`. Chấm điểm vẫn gọi `shared/scoring.ts` (web cũng dùng).
- Use case `attempts/`: `StartAttempt`, `SaveAnswer`, `SubmitAttempt` (mỗi cái một unit, sự kiện sau commit), `GetAttemptView`, `GetAttemptReview`, `GetParticipantReview` (mentor), `GetMemberState` (`GET /api/me`), `AutoSubmitOpenAttempts` (cài `AttemptAutoSubmitter` của P3-1, chạy trong unit của `CloseSession`: adapter tạm đã xóa).
- Port: `AttemptReader`/`AttemptRepository`, `MemberRoomReader`; `ExamReader` thêm `findQuestion` (autosave không tải cả đề) và `maxAutoScoreOf` (truy vấn aggregate cho `/api/me`, giữ nguyên như trước).
- **Không rò đáp án: chốt ở presenter.** Use case trả dữ liệu miền (có đáp án đúng); `interface/http/presenters/attempt-presenter.ts` là nơi duy nhất dựng DTO member, từng trường một. `toAttemptViewDto` không có `isCorrect`/`explanation`, `toReviewViewDto` chỉ được gọi với dữ liệu mà `GetAttemptReview` đã cho phép (test `attempt-presenter.test.ts` + `leak-guard` + route test).
- `DrizzleSessionReader.findDetail` tính tiến độ bằng `infrastructure/db/session-progress.ts` (3 truy vấn + `computeProgress` của domain), thay cho `getSessionProgress` cũ.
- Đo `GET /api/me` (`npx tsx scripts/bench-me.ts`, 3000 request tuần tự qua `app.inject`, DB `:memory:`, một member đang làm dở, Node 22): **trước** 1010.9 / 853.1 / 910.5 µs/request; **sau** 955.4 / 1037.7 / 1047.8 µs/request. Số truy vấn không đổi (không có N+1) nhưng trung bình sau cao hơn khoảng 10% (~925 → ~1013 µs), nhiều khả năng do thêm các `await` và lần lấy mutex cho mỗi truy vấn; độ nhiễu giữa các lần chạy cùng cỡ chênh lệch (±100 µs), nên chưa kết luận chắc.

### 11.5 Module `grading`, `leaderboard`, `discussion`, `screen` (P3-4, issue #16)

- `domain/grading/grading.ts`: `shuffleKey` (khóa xáo ổn định dùng chung cho màn chấm và màn thảo luận, nhãn "Bài #k" không lộ thứ tự vào phòng), `pickCountedAttempts`, `essayProgress`, `canFinalize`, `assertGradable` (thứ tự kiểm tra như cũ), `normalizeFeedback`, `manualTotal`. `domain/leaderboard/leaderboard.ts`: `buildLeaderboard` (chỉ tính điểm tự động tới khi chốt, đồng hạng cùng thứ hạng). Test thuần ở `domain/grading/grading.test.ts`.
- Use case: `GetGradingView`, `GradeAnswer` (một unit: chấm, tính lại tổng điểm tay của attempt, trả `graded/total`, phát `leaderboard` sau commit), `GetDiscussionView`, `GetLeaderboard`, `GetProjectorRoom`, và `CountUngradedEssays` (cài `UngradedEssayCounter` của P3-1: adapter tạm đã xóa).
- **Read model**: grading view, discussion view và leaderboard là truy vấn thuần đọc nên use case dựng thẳng DTO của `src/shared/api` (không qua entity). Ẩn danh/ẩn đáp án vẫn do use case quyết định (chỉ mở sau `closed`; thảo luận không có tên). Port đọc mới: `AttemptReader.listSubmittedOfActiveMembers/answersOfAttempts/findById/findAnswerById`, `ParticipantReader.namesOf`, `SessionReader.findActiveRoomCode`.
- `screenRoutes` giữ `requireLocal(false)`: mã phòng chỉ trả cho máy mentor, bỏ qua `--allow-remote-admin`.
