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
| `sessions` | id, exam_id, mode (`self_paced`\|`live`), status, shuffle (bool, mặc định true), created_at, opened_at?, started_at?, closed_at?, finalized_at? | MVP chỉ tạo `self_paced`. |
| `participants` | id, session_id, display_name, token (unique), status (`active`\|`pending`\|`kicked`), joined_at | Unique (session_id, lower(display_name)) cho participant chưa bị kick. |
| `attempts` | id, participant_id, attempt_no, question_order (JSON `number[]`), option_order (JSON `Record<questionId, optionId[]>`), started_at, submitted_at?, auto_score?, manual_score? | Thứ tự trộn sinh **lúc tạo attempt**, mỗi lần làm lại trộn lại. |
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

- **Mentor**: lần đầu chạy chưa có `admin_password_hash` → `POST /api/admin/setup` đặt mật khẩu (≥ 6 ký tự). Login → cookie `pq_admin` (httpOnly, sameSite=lax) chứa token ngẫu nhiên; token lưu trong `Map` bộ nhớ (restart server = login lại — chấp nhận). Hook `requireMentor` cho mọi route `/api/admin/*` trừ `setup`, `login`, `status`.
- **Member**: join trả về `token` (32 byte ngẫu nhiên, base64url). Web lưu ở `localStorage` key `pq:participant:<sessionId>`, gửi qua header `X-Participant-Token`. Hook `requireParticipant` cho `/api/me/*`; participant `kicked` → 403.

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
| POST | `/sessions` | `{ examId, shuffle? }` → session `draft` |
| GET | `/sessions` · `/sessions/:id` | list (mới nhất trước) · chi tiết kèm participants + tiến độ |
| POST | `/sessions/:id/{open,start,close,finalize}` | Chuyển trạng thái theo §3; sai → 409 |
| PATCH | `/participants/:id` | `{ displayName }` đổi tên |
| POST | `/participants/:id/{kick,approve}` | |
| GET | `/sessions/:id/grading` | Câu tự luận + bài làm của các attempt được tính, nhóm theo câu |
| PUT | `/answers/:id/grade` | `{ score, feedback? }`, 0 ≤ score ≤ points; chỉ khi session `closed` |

### Công khai / member
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/sessions/active` | — | Phiên đang `lobby`/`running` (id, title, status) hoặc `null` |
| POST | `/api/sessions/:id/join` | — | `{ displayName }` → `{ token, participant }`. Lobby → `active`; running → `pending`; trùng tên → 409 |
| GET | `/api/sessions/:id/participants` | — | Chỉ `{ displayName }[]` của participant `active` (cho màn hình chiếu) |
| GET | `/api/sessions/:id/leaderboard` | — | Xem §6 |
| GET | `/api/sessions/:id/events` | — | SSE, xem §7 |
| GET | `/api/me` | participant | participant + session (id, title, status, `participantCount` = số người `active`) + attempt hiện tại / đã nộp |
| POST | `/api/me/attempts` | participant | Bắt đầu lượt. Cần session `running`, participant `active`, không có lượt đang dở, đúng luật làm lại |
| GET | `/api/me/attempts/:id` | participant | Câu hỏi theo thứ tự đã trộn + câu trả lời đã lưu |
| PUT | `/api/me/attempts/:id/answers/:questionId` | participant | `{ selectedOptionIds }` hoặc `{ textAnswer }` — autosave |
| POST | `/api/me/attempts/:id/submit` | participant | Nộp, chấm tự động, trả về điểm |
| GET | `/api/me/attempts/:id/review` | participant | Chỉ khi session `closed`/`finalized`: đáp án đúng, giải thích, điểm, nhận xét |

### ⚠️ Quy tắc không lộ đáp án (bắt buộc có test)
Trước khi session `closed`, **không response nào gửi cho member** được chứa `is_correct`, `explanation`, hay điểm từng câu. Dùng type DTO riêng cho member (`MemberQuestion`, `MemberOption`) — không trả thẳng row DB.

## 6. Chấm điểm & xếp hạng

Hàm thuần trong `src/shared/scoring.ts`:
- `scoreAnswer(question, selectedOptionIds)`: single/multi — tập chọn **bằng đúng** tập đúng → `points`, ngược lại 0. Essay → `null` (chờ chấm tay).
- **Attempt được tính** của một participant: đề có tự luận → attempt duy nhất; thuần trắc nghiệm → attempt đã nộp có điểm cao nhất (bằng điểm → nộp sớm hơn).
- **Leaderboard**: participant `active` có ≥ 1 attempt đã nộp; điểm = auto + manual của attempt được tính; sắp giảm dần theo điểm, bằng điểm → `submitted_at` sớm hơn xếp trên. Response: `{ provisional: boolean, entries: { rank, displayName, score, maxScore, submittedAt }[] }`, `provisional = status !== 'finalized'`.

## 7. Realtime (SSE)

- Event bus trong process: `src/server/events.ts` — `publish(sessionId, type)`, `subscribe(sessionId, listener)`.
- `GET /api/sessions/:id/events` → `text/event-stream`, gửi `event: <type>\ndata: {}\n\n`; heartbeat comment mỗi 20s.
- Event types: `session` (đổi status), `participants` (join/kick/rename/approve), `leaderboard` (có bài nộp/chấm điểm).
- **Event chỉ là tín hiệu "có thay đổi"** — client nhận event thì gọi lại API REST tương ứng. Không đẩy dữ liệu qua SSE (tránh lộ đáp án, đơn giản hoá).
- Web: hook `useSessionEvents(sessionId, handlers)` dùng `EventSource`, tự kết nối lại.

## 8. Frontend routes

| Route | Ai | Màn hình |
|---|---|---|
| `/` | member | Vào phiên đang hoạt động (nhập tên) → phòng chờ → làm bài → kết quả/xếp hạng → xem lại |
| `/screen` | máy chiếu | Màn hình chiếu của phiên đang hoạt động (hoặc phiên gần nhất) |
| `/admin/login` | mentor | Setup lần đầu / đăng nhập |
| `/admin/exams` · `/admin/exams/import` · `/admin/exams/:id` | mentor | Danh sách đề · import + preview · chi tiết đề |
| `/admin/sessions` · `/admin/sessions/:id` | mentor | Lịch sử phiên · điều khiển phiên (lobby, tiến độ, đóng) |
| `/admin/sessions/:id/grading` | mentor | Chấm tự luận |

Gọi API qua `src/web/lib/api.ts` (wrapper `fetch`, tự gắn token member, ném lỗi có `message` từ `{ error }`). UI text tiếng Việt.
