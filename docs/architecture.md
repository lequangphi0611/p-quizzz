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
| E2E + ảnh chụp | `@playwright/test` 1.63.0 (devDependency; chạy `npm run e2e`, dùng Chromium có sẵn trong máy). Test ở `e2e/`, ảnh lưu `docs/design/<story>-assets/` |

## 2. Data model

Tên bảng/cột snake_case trong SQLite, camelCase trong Drizzle. Mọi `id` là `integer` autoincrement. Thời gian: `integer` mode `timestamp_ms`. `points` là số nguyên; mọi cột điểm đạt được (`auto_score`, `manual_score`) là `real` (chấm tay cho phép 0.5).

```
exams ──< questions ──< options
  │
  └──< sessions ──< participants ──< attempts ──< answers >── questions
```

| Bảng | Cột | Ghi chú |
|---|---|---|
| `exams` | id, title, description?, duration_minutes? (từ key `duration` của frontmatter; `null` = không giới hạn, PRODUCT.md §7.27), source_markdown, total_points, has_essay, created_at | `source_markdown` lưu nguyên file đã import. **Đề bất biến** sau khi tạo (không có API sửa). |
| `questions` | id, exam_id, position, type (`single`\|`multi`\|`essay`), prompt, body, points, explanation?, require_reason (bool, mặc định false) | `position` theo thứ tự trong file. `require_reason`: thuộc tính `{reason}` của câu trắc nghiệm (PRODUCT.md §7.32), luôn false với tự luận. |
| `options` | id, question_id, position, text, is_correct | |
| `sessions` | id, exam_id, name, mode (`self_paced`\|`live`), status, shuffle (bool, mặc định true), auto_approve (bool, mặc định false), access (`free`\|`roster`, mặc định `free`), outsider_policy (`block`\|`pending`, mặc định `block`), score_visibility (`on_submit`\|`on_release`, mặc định `on_submit`), scores_released_at?, time_limit_minutes?, ends_at?, scheduled_start_at?, countdown_ends_at?, countdown_source? (`now`\|`ready`), auto_start_ready (bool, mặc định false), ready_min?, start_schedule_dropped_at?, source_group_id? (→ `groups`, `ON DELETE SET NULL`), room_code?, slot?, created_at, opened_at?, started_at?, closed_at?, finalized_at?, shared_at? | MVP chỉ tạo `self_paced`. `room_code`: 6 chữ số ngẫu nhiên, sinh khi `open`, unique; `null` khi còn `draft`. `name`: nhãn **chỉ mentor thấy** để phân biệt các phiên chạy song song (mặc định "tên đề – dd/MM"; member và màn chiếu chỉ thấy tên đề, PRODUCT.md §7.5/§7.24). `slot`: số nhỏ nhất chưa dùng trong các phiên đang mở, gán khi `open`, xoá khi `close`. `score_visibility`/`scores_released_at`: giữ điểm tới khi công bố (PRODUCT.md §7.25). **Điểm đang giữ** = `on_release` và `scores_released_at` null và phiên chưa `closed` (hàm thuần `domain/session/score-visibility.ts`; đóng phiên là công bố, không ghi cột). `time_limit_minutes`: giới hạn thời gian (PRODUCT.md §7.27), mặc định lấy `exams.duration_minutes` khi tạo, chỉ đổi được ở `draft`/`lobby`; `ends_at`: hạn chung của phiên, gán khi `start` (= `started_at` + giới hạn), "+N phút" đẩy lùi. Quy tắc thuần ở `domain/session/time-limit.ts` và `src/shared/session-timer.ts`. **Bắt đầu phiên** (PRODUCT.md §7.31): `scheduled_start_at` = giờ hẹn của mentor; `countdown_ends_at` = hết đếm ngược 10 giây của "Bắt đầu ngay" (`countdown_source = now`) hoặc "mọi người sẵn sàng" (`ready`); phiên bắt đầu ở mốc **sớm hơn** trong hai mốc. `auto_start_ready` + `ready_min`: tự bắt đầu khi mọi người sẵn sàng. `start_schedule_dropped_at`: giờ hẹn bị bỏ vì đã quá giờ khi server chạy lại (cho chuông). Quy tắc thuần ở `domain/session/start.ts` và `src/shared/session-start.ts`. `shared_at`: phiên đang được chia sẻ trên trang chia sẻ từ lúc nào (PRODUCT.md §7.33), `null` = không chia sẻ; chỉ gán được khi `closed`/`finalized`. |
| `participants` | id, session_id, display_name, email?, token (unique), replaced_token?, rejoin_allowed_until?, status (`active`\|`pending`\|`kicked`), joined_at, ready_at? (bấm "Sẵn sàng" ở phòng chờ, §7.31d), present_at_start (bool: đã được duyệt và có mặt lúc phiên bắt đầu → vào thẳng câu 1; không thì là người vào trễ, §7.31f) | Unique (session_id, lower(display_name)) và unique (session_id, email) (email không null) cho participant chưa bị kick. `email`: đã chuẩn hoá (chữ thường), chỉ có ở phiên `roster`, **chỉ mentor thấy** (PRODUCT.md §7.24). `replaced_token`: token cũ khi mentor cho người đó vào lại từ máy khác (máy cũ nhận 403 `replaced`). `rejoin_allowed_until`: mentor đã "cho vào lại" trước: đến lúc đó nhập lại đúng email/tên thì thay chỗ ngay, một lần (§7.23e). |
| `rejoin_requests` | id, participant_id (người đang giữ chỗ), claimant_name, token (unique), status (`pending`\|`approved`\|`rejected`\|`cancelled`), created_at, resolved_at? | Yêu cầu "đó là tôi, cho vào lại" (§7.23). `token` là token người xin sẽ giữ nếu được duyệt: trước đó chỉ đọc được trạng thái yêu cầu. `expired` không lưu: suy ra khi đọc (yêu cầu chờ mà phiên không còn mở). |
| `groups` | id, name, created_at, updated_at | Nhóm học viên của mentor (PRODUCT.md §7.22). Tên duy nhất không phân biệt hoa thường (so ở domain). |
| `group_emails` | id, group_id (cascade), email, position | Email đã chuẩn hoá, unique (group_id, email), `position` = thứ tự đã gõ. |
| `session_roster` | id, session_id (cascade), email, position | **Bản chụp** danh sách của một phiên lúc tạo (sửa/xoá nhóm sau không đổi nó); mentor có thể thêm email cho một phiên. Unique (session_id, email). |
| `attempts` | id, participant_id, attempt_no, question_order (JSON `number[]`), option_order (JSON `Record<questionId, optionId[]>`), started_at, submitted_at?, auto_score?, manual_score?, edit_status? (`pending`\|`approved`\|`rejected`\|`done`), edit_reason?, edit_requested_at?, edit_resolved_at? | Thứ tự trộn sinh **lúc tạo attempt**. Mỗi participant có đúng 1 attempt mỗi phiên (`attempt_no` luôn là 1). `edit_*` = yêu cầu sửa bài tự luận (PRODUCT.md §7.21): tối đa một yêu cầu sống, `rejected` được gửi lại (ghi đè), `approved`/`done` thì không xin thêm. `NULL` = chưa từng xin. |
| `answers` | id, attempt_id, question_id, selected_option_ids (JSON `number[]`)?, text_answer?, reason_text?, auto_score?, manual_score?, feedback?, graded_at? | Unique (attempt_id, question_id). Upsert khi autosave. `reason_text`: lý do của câu `{reason}` (đã trim, ≤ 500 ký tự), **không tính điểm** (PRODUCT.md §7.32). |
| `ai_suggestions` | id, answer_id (unique, cascade), status (`queued`\|`running`\|`done`\|`failed`), score?, feedback?, criteria (JSON `{ label, score, max, note }[]`)?, suspicious (bool, mặc định false), suspicious_reason?, suspicious_lines (JSON `number[]`, số dòng 1-based của bài)?, error?, model?, used (`accepted`\|`edited`)?, requested_at, finished_at? | Gợi ý chấm của AI cho **một** bài tự luận (PRODUCT.md §7.28). **Không phải điểm**: không đọc vào `manual_score`, tổng điểm, bảng xếp hạng hay `canFinalize`. `score` là `real` (bước 0,5). Một dòng mỗi answer; thử lại = ghi đè dòng `failed`; "Dừng" xoá các dòng `queued`. `used`: mentor đã lưu điểm bằng "Dùng gợi ý" (`accepted`) hoặc "Sửa rồi lưu" (`edited`); chấm tay hoặc huỷ điểm thì về `null`. Giữ lại sau khi mentor chấm để so độ lệch với `manual_score` (§7.28i). |
| `trainings` | id, name, status (`open`\|`stopped`\|`ended`), room_code?, created_at, stopped_at?, ended_at?, member_count? | Buổi training AI (PRODUCT.md §7.34). Tạo là mở (`open`, không có nháp). `room_code` 6 chữ số, **duy nhất chung với `sessions.room_code`** (cấp mã kiểm cả hai bảng); về `null` khi `stopped`. `member_count` chỉ ghi lúc Kết thúc. |
| `training_members` | id, training_id (cascade), display_name, token (unique, token trình duyệt), ingest_token (unique, nằm trong cấu hình hook trên máy member), consented_at, first_seen_at?, last_seen_at?, seen_after_stop_at?, uninstall_check_at?, uninstalled_at? | Chỉ tạo khi member đã đồng ý. Rút đồng ý / mentor mời ra = xoá dòng (cascade sự kiện). Tên duy nhất trong một buổi, so không phân biệt hoa thường (domain). Hai token khác nhau: lộ file cấu hình chỉ cho phép gửi sự kiện giả, không đọc được gì. |
| `training_events` | id, member_id (cascade), kind (`prompt`\|`tool`), claude_session_id, received_at, prompt?, tool_name?, tool_target?, ok? (bool), duration_ms?, error_excerpt?, output_head?, output_tail?, output_omitted_lines?, change_head?, change_tail?, change_omitted_lines? | Chỉ trường đã lọc (§11.8), **không bao giờ** lưu JSON thô của hook. Index (member_id, id). Danh sách chỉ đọc cột nhẹ; `output_*`/`change_*` chỉ đọc khi mentor bấm "Xem". |
| `app_meta` | key, value, updated_at | Đã có. Lưu `admin_password_hash` và `share_token` (token của link trang chia sẻ, 32 byte base64url, sinh lần đầu mentor lấy link, thay khi "Đổi link", PRODUCT.md §7.33). |

## 3. State machine phiên thi

Hàm thuần `src/shared/session-state.ts`:

```ts
type SessionStatus = 'draft' | 'lobby' | 'running' | 'closed' | 'finalized';
type SessionAction = 'open' | 'start' | 'close' | 'finalize';
function nextStatus(current: SessionStatus, action: SessionAction): SessionStatus | null; // null = không hợp lệ
```

| Từ | Action | Sang | Điều kiện / tác dụng phụ |
|---|---|---|---|
| draft | open | lobby | Sinh `room_code` mới và `slot` thấp nhất còn trống. **Nhiều phiên có thể hoạt động cùng lúc** (PRODUCT.md §7.5). |
| lobby | start | running | Có giới hạn thời gian → `ends_at = now + time_limit_minutes`. Đánh dấu `present_at_start` cho mọi participant `active`; xoá đếm ngược. Do mentor gọi `start` (chạy ngay), **hoặc tự động** khi tới mốc bắt đầu (§2): `StartDueSessions` chạy mỗi giây (cùng `deadline-watcher.ts`, bật trong `index.ts`), kiểm lại trong unit of work. Mốc đã qua quá `START_LATE_TOLERANCE_MS` (15 giây, tức server tắt/ngủ lúc đó) thì **bỏ**, không bắt đầu. Watcher cũng bắt đầu đếm ngược 10 giây khi `auto_start_ready` bật, số người `active` ≥ `ready_min`, tất cả đã sẵn sàng và không ai `pending`. |
| running | close | closed | Mọi attempt chưa nộp được **tự nộp** với câu trả lời đã lưu. Nếu đề không có tự luận → tự chuyển tiếp `finalized`. Do mentor bấm, **hoặc tự động** khi `now ≥ ends_at + TIME_UP_GRACE_MS` (5 giây): `CloseExpiredSessions` chạy mỗi giây và một lần lúc khởi động (`infrastructure/system/deadline-watcher.ts`, bật trong `index.ts`), kiểm lại trong unit of work để "+N phút" hay "Đóng" đến trước thì thắng. |
| closed | finalize | finalized | Mọi câu tự luận của các attempt được tính đã có `manual_score`. |

## 4. Xác thực

- **Mentor**: lần đầu chạy chưa có `admin_password_hash` → `POST /api/admin/setup` đặt mật khẩu (≥ 6 ký tự). Login → cookie `pq_admin` (httpOnly, sameSite=lax) chứa token ngẫu nhiên; token lưu trong `Map` bộ nhớ (restart server = login lại — chấp nhận). Hook `requireMentor` cho mọi route `/api/admin/*` trừ `setup`, `login`, `status`. Trước cả hook đó, `requireLocal` chặn (403) mọi request `/api/admin/*` không đến từ máy chạy app (loopback hoặc IP của chính các interface của máy); `--allow-remote-admin` / `ALLOW_REMOTE_ADMIN=1` tắt chặn này. IP lấy từ socket; `X-Forwarded-For` chỉ được tin khi peer là loopback (proxy dev của Vite, cấu hình `xfwd`).
- **Member**: join cần **mã phòng** của phiên (`room_code`, PRODUCT.md §7.16), kiểm trên server, so sánh hằng-thời-gian và giới hạn số lần sai theo IP. Join trả về `token` (32 byte ngẫu nhiên, base64url). Web lưu ở `localStorage` key `pq:participant:<sessionId>`, gửi qua header `X-Participant-Token`. Hook `requireParticipant` cho `/api/me/*`; participant `kicked` → 403. Token đã bị thay (`replaced_token`) → 403 `code: 'replaced'`. Mỗi request qua hook là một dấu hiệu còn kết nối: `PresenceTracker` (trong bộ nhớ, không ghi DB) nhớ lần cuối thấy; `online` = còn trong 15 giây (3 chu kỳ poll 5 giây của web), mentor thấy trong `participants[].connection` của chi tiết phiên.

## 5. API

**Đồng hồ phiên** (PRODUCT.md §7.27): DTO mentor (`SessionSummary`: `timeLimitMinutes`, `timer`), `/api/me` (`session.timer`) và `ActiveSession` (`timer`) dùng chung `SessionTimer = { limitMinutes, endsAt, remainingMs }` (`src/shared/session-timer.ts`); `null` khi không giới hạn hoặc phiên đã kết thúc; `endsAt`/`remainingMs` là `null` trước khi bắt đầu. `remainingMs` do server tính lúc trả lời, **luôn bằng `Clock` được inject** (route nhận `clock` qua composition, presenter bắt buộc tham số `now`), cùng đồng hồ đặt và kiểm hạn: client đếm ngược từ đó (không tin đồng hồ máy member) và neo lại mỗi lần tải lại.

Mọi body/response là JSON. Lỗi: `{ error: string, code?: string }` (tiếng Việt, hiển thị được cho người dùng) với status 400/401/403/404/409; `code` (tuỳ chọn, ví dụ `identity_in_use`) là lý do máy đọc được để web quyết định bước tiếp theo. Schema zod và type response đặt ở `src/shared/api/<nhóm>.ts`.

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
| POST | `/sessions` | `{ examId, name?, shuffle?, autoApprove?, access?, outsiderPolicy?, scoreVisibility?, timeLimitMinutes? }` → session `draft`. `timeLimitMinutes`: số nguyên 1–300, `null` = không giới hạn, bỏ trống = `duration` của đề. `access`: `{kind:'free'}` (mặc định) \| `{kind:'group', groupId}` \| `{kind:'emails', emails[]}` (danh sách tạm); phiên `roster` bỏ qua `autoApprove`. |
| POST | `/sessions/:id/roster` | `{ emails[] }` thêm email cho **một phiên** (ngoại lệ, không sửa nhóm gốc). 409 nếu phiên tự do hoặc đã kết thúc |
| POST | `/sessions/:id/save-group` | `{ name }` lưu danh sách của phiên thành nhóm → `{ id, name, emailCount }`. 409 nếu đã lưu / tên trùng |
| POST | `/groups/preview` | `{ text, defaultDomain? }` → `{ valid, duplicates, invalid }` có số dòng (không lưu gì) |
| GET · POST | `/groups` | danh sách (`emailCount`, `lastUsedAt`) · tạo `{ name, emails[] }` |
| GET · PUT · DELETE | `/groups/:id` | chi tiết kèm email · thay tên và danh sách · xoá (phiên đã tạo từ nhóm không bị ảnh hưởng) |
| GET | `/sessions` · `/sessions/:id` | list (mới nhất trước; `?active=true` = chỉ `lobby`/`running`, slot thấp trước) · chi tiết kèm participants (summary/chi tiết có thêm `scoreVisibility`, `scoresReleasedAt`, `scoresHidden`; chi tiết có `exam { id, title, hasEssay, totalPoints, questionCount }`), mỗi người có `progress { state: none\|doing\|submitted, attempts, countedScore, maxScore, submittedAt, editRequest, answered }` (`answered` = số câu đã trả lời của lượt **đang làm dở** trên tổng `exam.questionCount`, chỉ có khi phiên `running`, ngược lại `null`; PRODUCT.md §7.26, không bao giờ có số câu đúng) (`editRequest: { status, reason, requestedAt } \| null`, cho chuông và trang điều khiển) (`submittedAt` = epoch ms lúc nộp lượt được tính, `null` khi chưa nộp; dùng cho chuông thông báo) |
| POST | `/sessions/:id/{open,start,close,finalize}` | Chuyển trạng thái theo §3; sai → 409 |
| PUT | `/sessions/:id/score-visibility` | `{ scoreVisibility }` (§7.25). 409 khi đã có người nộp (kể cả bị kick), đã công bố hoặc phiên đã kết thúc. Phát `session` + `leaderboard` |
| PUT | `/sessions/:id/time-limit` | `{ timeLimitMinutes: number \| null }` (§7.27c). Chỉ ở `draft`/`lobby`, ngược lại 409. Phát `session` |
| POST | `/sessions/:id/extend-time` | `{ minutes }` (1–60): "+N phút" cho cả phòng (§7.27e), `ends_at` += N (hạn đã qua thì tính từ bây giờ), `time_limit_minutes` += N. Chỉ khi `running` và có giới hạn, ngược lại 409. Phát `session` |
| POST | `/sessions` (bổ sung S29) | Body tạo phiên nhận thêm `startsAt?` (epoch ms, phải ở tương lai) và `autoStart? { enabled, minParticipants }` (PRODUCT.md §7.31); sai thì 400 và không tạo phiên |
| PUT | `/sessions/:id/start-schedule` | `{ startsAt: number \| null }` (epoch ms, phải ở tương lai, không thì 400): hẹn/đổi/bỏ giờ bắt đầu (§7.31b). Chỉ ở `draft`/`lobby`, ngược lại 409. Phát `session` |
| POST | `/sessions/:id/start-countdown` | "Bắt đầu ngay": đếm ngược 10 giây rồi watcher bắt đầu phiên (§7.31c). Chỉ ở `lobby`; đang đếm thì giữ nguyên. Phát `session`. (`POST /sessions/:id/start` vẫn chạy ngay, không đếm ngược.) |
| POST | `/sessions/:id/cancel-countdown` | Huỷ đếm ngược, đồng thời **tắt** `auto_start_ready` (§7.31c). Không có đếm ngược → 409. Phát `session` |
| PUT | `/sessions/:id/auto-start` | `{ enabled, minParticipants }` (1–500): "Tự bắt đầu khi mọi người sẵn sàng" (§7.31e). Chỉ ở `draft`/`lobby`. Phát `session` |
| POST | `/sessions/:id/release-scores` | "Công bố điểm": ghi `scores_released_at`. 409 nếu phiên không đang giữ điểm. Phát `session` + `leaderboard` |
| PUT | `/sessions/:id/share` | `{ shared: boolean }` (PRODUCT.md §7.33): bật/tắt chia sẻ. Bật chỉ khi `closed`/`finalized` (khác → 409); bật lại khi đang bật giữ nguyên `shared_at`; tắt luôn được. → `{ sharedAt: number \| null }`. `SessionSummary` và chi tiết có `sharedAt`; chi tiết có thêm `share: { examUnfinishedSessions: number, submitted: number }` = số phiên khác của cùng đề đang `draft`/`lobby`/`running` (cảnh báo mạnh + ô xác nhận) và số bài nộp được tính (cảnh báo khi < 5) |
| GET | `/share-link` | `{ token, sharedCount }`: token của trang chia sẻ (sinh nếu chưa có), số phiên đang chia sẻ. Web dựng URL `/shared/<token>` theo địa chỉ LAN (`/api/network`) |
| POST | `/share-link/rotate` | "Đổi link": thay `share_token` → `{ token, sharedCount }` (cùng dạng `GET /share-link`). Token cũ hết hiệu lực ngay |
| PATCH | `/participants/:id` | `{ displayName }` đổi tên |
| POST | `/participants/:id/{kick,approve}` | |
| POST | `/rejoin-requests/:id/{approve-keep,approve-takeover,reject}` | Trả lời yêu cầu vào lại (§7.23c): **giữ bài** (đổi token của người giữ chỗ sang token người xin; máy cũ nhận 403 `replaced`), **mạo danh** (người giữ chỗ bị kick và mất lượt, người xin vào như người mới với tên họ nhập; 409 nếu tên đã bị người khác dùng, không đổi gì), **từ chối**. Chỉ khi yêu cầu còn `pending` và phiên còn mở (409), không bao giờ tự duyệt. Phát `participants` (+ `leaderboard` khi mạo danh) |
| POST | `/participants/:id/allow-rejoin` | "Cho vào lại" trước: đặt `rejoin_allowed_until` = bây giờ + 10 phút → `{ until }`. Chỉ khi phiên còn mở và người đó chưa bị kick |
| POST | `/participants/:id/edit-request/{approve,reject}` | Duyệt/từ chối yêu cầu sửa bài tự luận (§7.21). Chỉ khi phiên `running` và yêu cầu đang `pending`, ngược lại 409. Phát event `participants` |
| GET | `/sessions/:id/grading` | Câu tự luận + bài làm của các attempt được tính, nhóm theo câu. Thêm `aiGrader: { available: boolean }` (không bao giờ có nội dung cấu hình). Mỗi câu có `hasRubric` (`explanation` có chữ), `rubric: { criteria: { text, points }[], model: string } \| null` (rubric tách được thành tiêu chí có điểm, `src/shared/rubric.ts`; web đánh số T1…Tn) và `ai: { queued, running, done, failed }`; mỗi bài có `aiSuggestion: { status, score, feedback, criteria, suspicious, suspiciousReason, suspiciousLines, error, used } \| null` (PRODUCT.md §7.28). Web tự làm mới mỗi 3 giây khi còn gợi ý `queued`/`running` (không thêm event SSE) |
| GET | `/sessions/:id/discussion` | Chế độ thảo luận (S17). Chỉ khi `closed`/`finalized` (khác → 409). Trả `examTitle`, `submitted`, tiến độ chấm `graded/total`. Mỗi câu theo `position`: nội dung, lời giải, options kèm `isCorrect` và **số người chọn**; thống kê đúng/sai/bỏ trống; câu tự luận: các bài **ẩn danh** `{ answerId, label: "Bài #k", textAnswer, manualScore, feedback }` theo thứ tự trộn cố định. **Không** trả `displayName`/`participantId`. Chấm điểm dùng `PUT /answers/:id/grade`. **Không** trả `aiSuggestion` hay trạng thái AI (§7.28f). Câu `{reason}`: `requireReason: true` và `reasons: { optionIds (đã sắp), text \| null }[]` = mọi bài được tính có chọn đáp án ở câu đó, **không id/tên**, thứ tự trộn cố định (cùng cách trộn bài tự luận); `text: null` = chọn nhưng chưa ghi lý do (PRODUCT.md §7.32e) |
| GET | `/participants/:id/review` | Bài làm của một người trong phiên (lượt duy nhất): từng câu theo thứ tự họ thấy, lựa chọn của họ, đáp án đúng, giải thích, điểm. Xem được ở mọi trạng thái phiên (chỉ mentor). `{ participant, state, attempt: ReviewView \| null }` |
| PUT | `/answers/:id/grade` | `{ score, feedback?, aiUse?: 'accepted' \| 'edited' }`, 0 ≤ score ≤ points; chỉ khi session `closed`. Đây cũng là cách mentor **xác nhận gợi ý AI** ("Dùng gợi ý" gửi đúng điểm + nhận xét của gợi ý với `aiUse: 'accepted'`; "Sửa rồi lưu" gửi `aiUse: 'edited'`; không gửi = chấm tay). Không có duyệt hàng loạt. Chấm một bài đang `queued` thì gỡ nó khỏi hàng đợi |
| DELETE | `/answers/:id/grade` | "Hoàn tác": xoá điểm và nhận xét của bài (về "Chưa chấm"), tính lại tổng điểm tay, `used` của gợi ý về `null`. Chỉ khi session `closed`. Phát `leaderboard` |
| POST | `/sessions/:id/questions/:questionId/ai-suggest/stop` | "Dừng": xoá các gợi ý `queued` của câu đó (bài đang `running` chạy nốt; gợi ý đã có giữ nguyên) → `{ stopped: number }` |
| POST | `/sessions/:id/questions/:questionId/ai-suggest` | Xếp hàng gợi ý AI cho mọi bài của câu tự luận đó (attempt được tính, participant `active`) **chưa được mentor chấm** và chưa có gợi ý `queued`/`running`/`done` (tức: chưa có hoặc `failed`). Body `{ answerIds?: number[] }` để thử lại một số bài. → `{ queued: number }`. 409: phiên không `closed`, câu không phải essay, câu **không có rubric** (`explanation` rỗng), AI không khả dụng. Chạy nền, trả về ngay |

### Công khai / member
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/rooms/resolve` | — | `{ roomCode }` → `{ id, title, status, access }` của phiên `lobby`/`running` có mã đó (title = tên đề, không bao giờ trả tên phiên hay mã). Mã sai **hoặc** phiên không còn mở → cùng một lỗi 403 "Mã phòng không đúng"; dùng **chung bộ giới hạn** (5 lần sai/phút/IP → 429) với `join` |
| GET | `/api/sessions/:id/public` | — | `{ id, title, status, access, timer }` của một phiên (trang chiếu theo dõi); 404 nếu không có **hoặc đang `draft`** (tên đề có thể là bài sắp thi; id đoán được) |
| GET | `/api/network` | — | `{ joinHosts: string[] }` — địa chỉ LAN `ip:cổng` để member gõ vào trình duyệt (cổng lấy từ Host của request) |
| POST | `/api/sessions/:id/join` | — | `{ displayName, roomCode, email? }` → `{ token, participant }`. Mã sai → 403, sai quá 5 lần/phút từ một IP → 429 (tính chung với `resolve` và với email không có trong danh sách). Phiên tự do: mặc định → `pending`, `autoApprove` → `active` ngay, trùng tên → 409 `{ error, code: 'identity_in_use' }`, `email` bị bỏ qua. Phiên `roster`: `email` bắt buộc (thiếu/sai định dạng → 400); email **trong** danh sách → `active` ngay; **ngoài** danh sách → 403 với **một** thông báo chung (hoặc `pending` nếu `outsider_policy = pending`); email đã có người → 409 `code: 'identity_in_use'` |
| POST | `/api/sessions/:id/rejoin-requests` | — | Body như `join` → `{ requestId, token, status: 'pending' \| 'approved' }`. Kiểm mã phòng và danh sách như `join` (sai → 403 và tính vào giới hạn chung); người giữ chỗ tìm theo email (phiên `roster`) hoặc tên (phiên tự do), không có → 409; tối đa 5 yêu cầu chờ cho một chỗ; thêm giới hạn 8 yêu cầu/phút/IP riêng. `approved` ngay chỉ khi mentor đã `allow-rejoin` cho người đó |
| GET | `/api/rejoin/status` | token của yêu cầu | `{ status: 'pending' \| 'approved' \| 'rejected' \| 'cancelled' \| 'expired', sessionId }`. Token yêu cầu **chỉ đọc được cái này** và huỷ; `/api/me` với nó vẫn 401 cho tới khi được duyệt |
| POST | `/api/rejoin/cancel` | token của yêu cầu | Người xin huỷ (204) |
| GET | `/api/sessions/:id/roster-counts` | — | `{ joinedCount, rosterSize }` của phiên `roster` (chỉ số đếm, không tên); `null` cho phiên tự do; 404 nếu không có hoặc đang `draft` |
| GET | `/api/screen/sessions` | chỉ máy mentor (không tính `--allow-remote-admin`) | `{ open: { id, name, slot, title, status }[], latestEnded }` — các phiên `/screen` theo dõi được (có tên phiên nên không ra LAN); `latestEnded` chỉ khi không có phiên nào mở |
| GET | `/api/screen/sessions/:id/room` | chỉ máy mentor (không tính `--allow-remote-admin`) | `{ roomCode: string \| null }` của phiên `lobby`/`running` đó — cho màn hình chiếu. Không bao giờ trả mã qua endpoint công khai |
| GET | `/api/sessions/:id/participants` | — | Chỉ `{ displayName }[]` của participant `active` (cho màn hình chiếu) |
| GET | `/api/sessions/:id/leaderboard` | — | Xem §6 |
| GET | `/api/shared/:token/sessions` | token chia sẻ | Trang chia sẻ (PRODUCT.md §7.33): `{ sessions: { id, examTitle, startedAt, questionCount }[] }` của các phiên có `shared_at`, `started_at` mới nhất trước. Token sai/đã đổi → 404 `{ error, code: 'share_link_invalid' }` (một thông báo trung tính). So token hằng-thời-gian |
| GET | `/api/shared/:token/sessions/:id` | token chia sẻ | `{ id, examTitle, startedAt, questionCount, submitted, questions: SharedQuestion[] }` theo `position`. `SharedQuestion = { id, position, type, prompt, body, points, explanation, options: { id, position, text, isCorrect }[], distribution: { counts: Record<optionId, number>, blank: number } \| null }`; `distribution` (đếm trên attempt được tính, như thảo luận) là `null` với tự luận và khi `submitted = 0`; **không có ngưỡng ẩn** (PO, 2026-11-19). Token sai → như trên; phiên không có `shared_at` (hoặc không tồn tại) → 404 `{ error, code: 'session_not_shared' }` |
| GET | `/api/sessions/:id/events` | — | SSE, xem §7 |
| GET | `/api/me` | participant | participant (kèm `ready`, `lateJoin` = phiên đã chạy mà người này không có mặt lúc bắt đầu, §7.31f) + session (`start: SessionStartInfo \| null` = giờ hẹn, đếm ngược, `early`, `ready { count, total }`, chỉ có trước khi chạy; chỉ con số, không bao giờ tên ai sẵn sàng/chờ duyệt; cũng có trong `ActiveSession` của màn chiếu và tra mã phòng; mentor thấy thêm `pendingCount`, `startScheduleDroppedAt`, `readyAt` từng người), id, title, status, `participantCount` = số người `active`, `questionCount`, `totalPoints`, `hasEssay`, `scoresHidden`, `timer`, `closedByTimer` = phiên đóng lúc/sau mốc hết giờ chứ không phải mentor đóng sớm, so `closed_at` với `ends_at` trên server) + `attempt: { current, submitted[], canStartNew }` (lượt đang làm, lượt đã nộp với điểm tự động `score/maxScore` và `essayScore` = tổng điểm tự luận đã chấm hoặc `null`, `canStartNew` = chưa có lượt nào và phiên đang `running`). Khi `scoresHidden`: `score` và `essayScore` là `null` (cả trong response của `submit`) |
| PUT | `/api/me/ready` | participant | `{ ready: boolean }`: "Sẵn sàng"/"Huỷ sẵn sàng" (§7.31d). Chỉ ở `lobby`, participant `active`, khi chưa đếm ngược; ngược lại 409. Phát `participants` |
| POST | `/api/me/attempts` | participant | Bắt đầu lượt. Cần session `running`, participant `active`; mỗi participant chỉ có 1 lượt/phiên (đã có lượt → 409) |
| GET | `/api/me/attempts/:id` | participant | Câu hỏi theo thứ tự đã trộn + câu trả lời đã lưu |
| PUT | `/api/me/attempts/:id/answers/:questionId` | participant | `{ selectedOptionIds, reasonText? }` hoặc `{ textAnswer }` — autosave. `reasonText` (trim, ≤ 500 ký tự) chỉ ở câu `requireReason` (khác → 400); bỏ trống = giữ lý do đã lưu (PRODUCT.md §7.32). Lượt đã nộp không bao giờ đổi được lý do (kể cả khi sửa tự luận được duyệt: câu trắc nghiệm → 409). Lượt đã nộp chỉ lưu được **câu tự luận** khi yêu cầu sửa đang `approved` và phiên `running` (§7.21). Quá `ends_at` + 5 giây → 409 "Đã hết giờ làm bài" (cả `submit` và bắt đầu lượt) |
| POST | `/api/me/attempts/:id/submit` | participant | Nộp, chấm tự động, trả về điểm. Còn câu `requireReason` đã chọn mà lý do trống → 409 `{ error, code: 'reason_missing', questionIds }` (theo thứ tự của lượt). Đóng phiên / hết giờ tự nộp **không** kiểm điều kiện này (PRODUCT.md §7.32b) |
| POST | `/api/me/attempts/:id/edit-request` | participant | `{ reason }` (1–500 ký tự). Xin sửa bài tự luận sau khi nộp. Cần phiên `running`, lượt đã nộp, chưa có yêu cầu `pending`/`approved`/`done` → ngược lại 409 |
| POST | `/api/me/attempts/:id/edit-request/finish` | participant | Kết thúc việc sửa (yêu cầu `approved` → `done`) |
| GET | `/api/me/attempts/:id/review` | participant | Chỉ khi session `closed`/`finalized`: đáp án đúng, giải thích, điểm, nhận xét; mỗi câu có `requireReason` và `reasonText` = lý do **của chính member** (không bao giờ của người khác). Mỗi câu có thêm `aiAssisted: boolean` = câu tự luận đó có ít nhất một gợi ý AI `done` trong phiên (để hiện dòng thông báo §7.28f); không bao giờ trả nội dung gợi ý Có thêm `shared: boolean` = phiên đang được chia sẻ (PRODUCT.md §7.33f). |

### Buổi training AI (PRODUCT.md §7.34, S32–S34)

Mentor (trong `/api/admin`, chỉ máy mentor như §4):

| Method | Path | Mô tả |
|---|---|---|
| POST | `/trainings` | `{ name }` (1–100 ký tự) → 201, training `open` kèm `roomCode`: `{ id, name, status, roomCode, createdAt, stoppedAt, endedAt, memberCount }` |
| GET | `/trainings` | Mới nhất trước: `{ id, name, status, createdAt, stoppedAt, endedAt, memberCount }[]` (`memberCount` đếm sống khi chưa `ended`) |
| GET | `/trainings/:id` | `{ id, name, status, roomCode (chỉ khi open), createdAt, stoppedAt, endedAt, uninstalled: { count, total } \| null (chỉ khi stopped), members: TrainingMemberRow[] }`; `TrainingMemberRow = { id, displayName, connection: 'waiting'\|'connected'\|'uninstalled', lastSeenAt, promptCount, toolCount, failedCount, stuck: boolean, stillSending: boolean }`. Học viên sắp theo thứ tự vào buổi (cố định, không sắp theo số lỗi). `uninstalled.count` đếm member có `connection = 'uninstalled'` (đã qua kiểm tra gỡ và không có gì gửi sau đó). Khi `ended`: `members = []` |
| GET | `/trainings/:id/members/:memberId/events` | `?after=<eventId>` (tối đa 500 dòng mỗi lần, cũ trước) → `{ events: TrainingEventRow[], hasMore }`; `TrainingEventRow = { id, kind, receivedAt, claudeSessionId, prompt?, toolName?, toolTarget?, ok?, durationMs?, summary?, hasOutput, hasChange }`; `summary` = `error_excerpt` (lệnh lỗi) hoặc dòng cuối có chữ của `output` (lệnh thành công). **Không** có `output_*`/`change_*`. Trường tuỳ chọn bị bỏ khi không áp dụng (dòng `prompt` không có `toolName`, dòng `tool` không có `prompt`). `after` không phải số nguyên ≥ 0 → 400; buổi hoặc học viên không có (kể cả học viên của buổi khác) → 404; `ended` → 409; `stopped` vẫn xem được. `summary` dựng ở server từ **hậu tố ≤ 1000 ký tự** của `coalesce(output_tail, output_head)` (cột output không bao giờ được đọc nguyên khi liệt kê), mỗi dòng cắt ở 200 ký tự, không thêm cột |
| GET | `/trainings/:id/events/:eventId/detail` | `{ output: Clip \| null, change: Clip \| null }`, `Clip = { head: string, tail: string \| null, omittedLines: number }`. Sự kiện không có hoặc của buổi khác → 404; `ended` → 409 |
| POST | `/trainings/:id/stop` | "Dừng thu": `open` → `stopped`, `room_code` = null. Khác → 409. Trả lại chi tiết buổi như `GET /trainings/:id` |
| POST | `/trainings/:id/end` | "Kết thúc": `stopped` → `ended`; trong **một** unit: ghi `member_count`, xoá mọi `training_members` (cascade sự kiện). Khác → 409. Trả lại chi tiết buổi như `GET /trainings/:id` |
| DELETE | `/trainings/:id/members/:memberId` | Mời ra: xoá member + sự kiện. `ended` → 409 |

Member và hook (công khai trong LAN):

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/rooms/resolve` (bổ sung) | — | Mã của training `open` → `{ kind: 'training', id, title }` (title = tên buổi). Phiên thi trả thêm `kind: 'session'`. Mã sai: như cũ, chung giới hạn |
| POST | `/api/trainings/:id/join` | — | `{ displayName, roomCode, consent: true }` → 201 `{ token, member: { displayName } }`. Kiểm mã như `join` của phiên (chung bộ giới hạn 5 lần/phút/IP). `consent` khác `true` → 400. Chỉ khi `open` (khác, kể cả `:id` không tồn tại → 403 trung tính như mã sai, tính vào giới hạn). Trùng tên → 409 `identity_in_use` (không có luồng xin vào lại; chọn tên khác) |
| GET | `/api/training/me` | `X-Training-Member-Token` | `{ training: { id, name, status }, member: { displayName, connection, uninstallCheck: 'none'\|'waiting'\|'passed'\|'failed' } }`. **Không bao giờ** có dữ liệu đã thu hay `ingest_token`. Token lạ (kể cả sau `ended`) → 401 |
| GET | `/api/training/me/hook-config` | `X-Training-Member-Token` | `{ settings, mergePrompt }`: `settings` = object để ghép vào `.claude/settings.local.json` (§11.8 `buildHookSettings`, URL lấy theo Host của chính request này); `mergePrompt` = câu nhờ Claude Code ghép (tiếng Việt, chứa `settings`). Chỉ khi `open`, khác → 409 |
| POST | `/api/training/me/uninstall-check` | `X-Training-Member-Token` | Bắt đầu kiểm tra gỡ: `uninstall_check_at = now` → 204. Chỉ khi `stopped`, khác → 409. Gọi lại được (đặt lại mốc), kể cả sau `failed` |
| POST | `/api/training/me/uninstall-check/finish` | `X-Training-Member-Token` | `seen_after_stop_at > uninstall_check_at` → `{ result: 'failed' }`; ngược lại ghi `uninstalled_at = now` → `{ result: 'passed' }`. Phải gọi ≥ 5 giây sau khi bắt đầu (sớm hơn → 409 `too_early`); chưa bắt đầu hoặc buổi không `stopped` → 409. Kết quả `passed` phát tín hiệu `training`. `uninstallCheck` của `GET /me` suy ra từ dữ liệu, không có cột riêng: `passed` khi đã `uninstalled_at` và không có sự kiện muộn hơn; `failed` khi có `seen_after_stop_at` muộn hơn mốc bắt đầu hoặc muộn hơn `uninstalled_at`; `waiting` khi đã bắt đầu mà chưa có gì; còn lại `none` |
| DELETE | `/api/training/me` | `X-Training-Member-Token` | Rút đồng ý: xoá member + sự kiện → 204. `ended` → 401 (đã xoá) |
| POST | `/api/training/ingest` | `X-Training-Token` (ingest token) | Body = JSON hook của Claude Code. `bodyLimit` 2 MB (quá → 413). Token lạ → 404 body rỗng. Training `open`: lọc (§11.8), lưu, cập nhật `first_seen_at`/`last_seen_at` → 204. `stopped`: **không lưu**, ghi `seen_after_stop_at` → 200 `{ "systemMessage": "<nhắc gỡ hook, tiếng Việt>" }`. Event ngoài `UserPromptSubmit`/`PostToolUse`/`PostToolUseFailure`, thân không phải JSON hợp lệ, thân rỗng hoặc content-type khác JSON → 204, không lưu, không cập nhật `last_seen_at` (hook báo lỗi sẽ làm ồn màn hình member, nên không bao giờ trả 4xx/5xx vì nội dung). Ở buổi `stopped` chỉ ba loại event trên mới tính là "vẫn gửi" (`seen_after_stop_at`). Không gọi mạng, chỉ một lần ghi DB: mục tiêu < 50 ms |

### ⚠️ Quy tắc không lộ đáp án (bắt buộc có test)
Trước khi session `closed`, **không response nào gửi cho member** được chứa `is_correct`, `explanation`, hay điểm từng câu. Dùng type DTO riêng cho member (`MemberQuestion`, `MemberOption`) — không trả thẳng row DB. Chỉ `GET /api/me/attempts/:id/review` được mang đáp án, và trả 403 cho tới khi session `closed`/`finalized`.

Phòng thủ nhiều lớp:
1. **DTO dựng từng trường** + test quét đệ quy key `isCorrect`/`is_correct`/`explanation` trên mọi response `/api/me/*`.
2. **Chốt chặn `src/server/interface/http/leak-guard.ts`** (hook `onSend` toàn cục): response JSON nào ngoài `/api/admin/*` và route review mà chứa các key đó sẽ bị thay bằng 500 và ghi log — bắt lỗi trả nhầm row DB trong tương lai. Key `email`/`emails` bị chặn **cả ở route review** (email chỉ mentor thấy, PRODUCT.md §7.24). Key `aiSuggestion` bị chặn ở mọi response ngoài `/api/admin/*` (gợi ý AI chỉ mentor thấy, PRODUCT.md §7.28f). Key `reasons` (lý do của cả lớp) cũng vậy, kể cả route review (PRODUCT.md §7.32e); member chỉ nhận `reasonText` của mình.
3. **`/api/admin/*` chỉ mở trên máy mentor** (§4), nên member không đọc được đề qua API mentor.
4. **Trang chia sẻ** (`/api/shared/*`, PRODUCT.md §7.33) mang đáp án và lời giải có chủ đích nên được miễn chặn `isCorrect`/`explanation` (chỉ khi phiên `closed`/`finalized` và có `shared_at`, kiểm trong use case). Đổi lại, ở các route này leak-guard **chặn thêm** key định danh và bài làm: `displayName`, `name`, `email`, `participant`, `selectedOptionIds`, `textAnswer`, `reasonText`, `feedback`, `score`, `aiSuggestion` (tên đề dùng key `examTitle`). Có test quét key trên cả hai route.
5. **Buổi training AI** (PRODUCT.md §7.34): nội dung đã thu (`prompt`, `toolTarget`, `summary`, `output`, `change`, `events`) chỉ đi qua `/api/admin/trainings/*`. leak-guard chặn các key đó trên mọi route `/api/training/*` và `/api/trainings/*`, và chặn key `ingestToken` ở mọi nơi (token ingest chỉ xuất hiện bên trong `settings` của `hook-config`, dưới dạng giá trị header). Test quét key cho các route member.
6. **Vite dev server** (`npm run dev`) mở ra LAN và mặc định phục vụ mọi file trong repo qua `/@fs/` (gồm `exams/`, `data/`). `vite.config.ts` đặt `server.fs.allow` chỉ gồm `src/web`, `src/shared`, `node_modules` và `deny` cho `exams/`, `data/`, `docs/`, `*.db`. Không nới lỏng mục này.

## 6. Chấm điểm & xếp hạng

Hàm thuần trong `src/shared/scoring.ts`:
- `scoreAnswer(question, selectedOptionIds)`: single/multi — tập chọn **bằng đúng** tập đúng → `points`, ngược lại 0. Essay → `null` (chờ chấm tay).
- **Attempt được tính** của một participant: attempt duy nhất của họ trong phiên (đã nộp).
- **Leaderboard**: participant `active` có ≥ 1 attempt đã nộp; điểm = auto + manual của attempt được tính; sắp giảm dần theo điểm, bằng điểm → `submitted_at` sớm hơn xếp trên. Response: `{ provisional: boolean, hidden: boolean, entries: { rank, displayName, score, maxScore, submittedAt }[], submitted: { displayName, submittedAt }[] }`, `provisional = status !== 'finalized'`. Khi điểm đang giữ (PRODUCT.md §7.25): `hidden = true`, `entries = []`, `submitted` = ai đã nộp theo giờ nộp; ngược lại `submitted = []`.

## 7. Realtime (SSE)

- Event bus trong process: `src/server/infrastructure/events/event-bus.ts` — `publish(sessionId, type)`, `subscribe(sessionId, listener)` (use case phát qua port `EventPublisher`, SSE nghe qua `EventSubscriber`).
- `GET /api/sessions/:id/events` → `text/event-stream`, gửi `event: <type>\ndata: {}\n\n`; heartbeat comment mỗi 20s.
- Event types: `session` (đổi status), `participants` (join/kick/rename/approve), `leaderboard` (có bài nộp/chấm điểm).
- **Buổi training AI** (§11.8): kênh mentor `/api/admin/events` mang thêm event type `training` với `data: {"trainingId":N}` khi có member vào/ra, có sự kiện mới, đổi trạng thái kết nối hoặc trạng thái buổi. Bus trong tiến trình có kênh riêng cho tín hiệu training (`publishTraining`/`subscribeTraining`, không dùng chung kênh theo `sessionId` vì hai loại id không liên quan nhau); `EventSubscriber.subscribeTraining` là cổng nghe. Ingest rất dày nên tín hiệu của ingest được **gộp** (`ThrottledTrainingSignals`, `TRAINING_SIGNAL_THROTTLE_MS` = 2000): tín hiệu đầu gửi ngay, mọi tín hiệu trong 2 giây kế tiếp gộp thành **một** tín hiệu khi hết cửa sổ (nên màn mentor không kẹt ở dữ liệu cũ); tối đa 1 tín hiệu mỗi 2 giây mỗi buổi. Chỉ ingest dùng bộ gộp; vào/ra, dừng, kết thúc và kết quả kiểm tra gỡ gửi ngay. Client hiện có chỉ đăng ký các event type của phiên nên tự bỏ qua `training`; `connectAdminEvents` nghe thêm event `training` và gọi `AdminEventHandlers.onTraining?(trainingId)` (tuỳ chọn, trang không hiện buổi training không cần quan tâm); `useAdminEvents` truyền xuống như cũ. UI dùng nó là S35. Member **không** dùng SSE: trang member poll `/api/training/me` mỗi 3 giây, chỉ khi đang chờ tín hiệu đầu tiên hoặc đang kiểm tra gỡ.
- **Kênh của mentor** `GET /api/admin/events` (trong vùng `/api/admin`, chỉ máy mentor): **một** kết nối mang tín hiệu của **mọi** phiên, payload `data: {"sessionId":N}` (vẫn chỉ là tín hiệu, client gọi lại REST). Lý do: trình duyệt chỉ cho ~6 kết nối HTTP/1.1 mỗi địa chỉ, chuông không thể mở một `EventSource` cho mỗi phiên đang mở. Web: `EventStream.subscribeAdmin`, hook `useAdminEvents`.
- **Event chỉ là tín hiệu "có thay đổi"** — client nhận event thì gọi lại API REST tương ứng. Không đẩy dữ liệu qua SSE (tránh lộ đáp án, đơn giản hoá).
- Web: hook `useSessionEvents(sessionId, handlers)` dùng `EventSource`, tự kết nối lại. **Mỗi tab chỉ mở 1 `EventSource` cho mỗi phiên**, dùng chung cho mọi component (đếm người đăng ký, người cuối rời thì đóng): mỗi `EventSource` giữ một kết nối HTTP/1.1 và trình duyệt chỉ cho 6 kết nối/địa chỉ, mở thừa sẽ làm treo mọi request khác. Không tạo `EventSource` trực tiếp ngoài hook này.

## 8. Frontend routes

| Route | Ai | Màn hình |
|---|---|---|
| `/` | member | Nhập mã phòng (hoặc mở link `/?room=…`) → nhập tên → phòng chờ → làm bài → kết quả/xếp hạng → xem lại |
| `/shared/:token` · `/shared/:token/sessions/:sessionId` | ai có link | Trang chia sẻ: danh sách phiên được chia sẻ · chi tiết một phiên, `#cau-<n>` nhảy tới câu (PRODUCT.md §7.33, S31) |
| `/screen` | máy chiếu (máy mentor) | Chỉ có một phiên mở → chuyển sang nó; nhiều phiên → trang chọn phiên; không có phiên mở → phiên vừa kết thúc |
| `/screen/:sessionId` | máy chiếu | Màn hình chiếu của **một** phiên (công khai trong LAN; chỉ hiện tên đề) |
| `/admin/login` | mentor | Setup lần đầu / đăng nhập |
| `/admin/exams` · `/admin/exams/import` · `/admin/exams/:id` | mentor | Danh sách đề · import + preview · chi tiết đề |
| `/admin/sessions` · `/admin/sessions/:id` | mentor | Lịch sử phiên · điều khiển phiên (lobby, tiến độ, đóng) |
| `/admin/sessions/:id/grading` | mentor | Chấm tự luận (kèm gợi ý AI, §11.6) |
| `/admin/ai-grader-help` | mentor | Hướng dẫn bật AI chấm nháp (tĩnh) |
| `/admin/sessions/:id/review` | mentor | Xem lại phiên: ai tham gia, bài từng người |
| `/admin/sessions/:id/discuss` | mentor | Chế độ thảo luận: chiếu từng câu, chấm tự luận cùng lớp (S17) |
| `/training/:id` | member | Buổi training AI (S36): nhập tên + đồng ý → hướng dẫn cài hook + chờ tín hiệu → đang thu → (sau Dừng thu) hướng dẫn gỡ + kiểm tra. Vào từ `/` bằng mã: `resolve` trả `kind: 'training'` thì `member-join` chuyển tới `/training/:id?room=<mã>` (`replace`, cùng quy ước `/?room=`; trang tự bỏ query sau khi vào). Token ở `localStorage` key `pq:training:<id>`; 401 → xoá token và hiện màn "đã kết thúc". Poll `/api/training/me`: 3 giây khi chờ tín hiệu đầu, đang kiểm tra gỡ hoặc mất kết nối, 10 giây khi đang thu hoặc xem hướng dẫn gỡ; tab ẩn không poll |
| `/admin/trainings` · `/admin/trainings/:id` | mentor | Danh sách + tạo buổi training · trang buổi training: member, trạng thái kết nối, cờ kẹt, dòng thời gian, xem output khi cần, Dừng thu / Kết thúc (S35). `?hv=<memberId>` giữ học viên đang chọn |

Chuông thông báo mentor (PRODUCT.md §7.20) nằm trong khung `/admin/*`: `useMentorNotices` (`features/mentor-notices/application`) lấy `/api/admin/sessions?active=true`, rồi `/api/admin/sessions/:id` của từng phiên đang mở và nghe **một** kênh `/api/admin/events` (mỗi thông báo gắn tên + slot của phiên); danh sách dựng bằng hàm thuần `features/mentor-notices/domain/mentor-notices.ts` từ `joinedAt`/`progress.submittedAt`; mốc đã xem ở `localStorage` key `pq:mentor:notices-seen:<sessionId>` (từng phiên một). Thanh "Đang mở" (`shared/ui/SessionStrip`, `Alt+1…9` theo slot) và phím `N` mở chuông nằm cùng khung. Thông báo desktop: `useDesktopNotify` (Notification API, cần secure context nên chỉ chạy trên `localhost`), lựa chọn bật/tắt ở `localStorage` key `pq:mentor:desktop-notify`, `tag` theo participant để nhiều tab không hiện trùng. Loại thông báo "xin sửa bài" (§7.21) dựng từ `progress.editRequest` của chính response đó; event `participants` có sẵn đủ để làm mới, không thêm event mới.

Gọi API qua client lõi `src/web/shared/api-client/` (wrapper `fetch`, interceptor gắn token member, ném `ApiError` có `message` từ `{ error }`); mỗi feature dùng nó qua `Http*Gateway` của mình (§12). UI text tiếng Việt. Hướng dẫn thêm feature: [how-to-add-a-feature.md](how-to-add-a-feature.md).

## 9. Layering (Clean Architecture)

> Đích của epic #7. Backend (P3-5) và frontend (P5-3) đã chuyển xong; allowlist của `arch:check` rỗng (§9.7). Refactor **không đổi hành vi nghiệp vụ và không đổi §1-§8**.

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

- Script tự viết (không thêm thư viện, nên §1 không đổi): `scripts/arch-check.ts` + `scripts/arch/{rules,check,allowlist}.ts`. Quét import (tĩnh, re-export, `import()`) của mọi `.ts/.tsx` trong `src/` và đối chiếu với bảng ở §9.2. Thêm một luật chung cho mọi layer (cả `composition.ts`): code không phải test không được import từ thư mục `testing/` (fake chỉ dành cho test; adapter thật nằm ở `infrastructure/`). Chạy được trên mọi OS; `scripts/arch/check.test.ts` chạy trong `npm test` nên vi phạm làm test đỏ.
- Mọi file dưới `src/` phải nằm trong một layer (đường dẫn theo §9.1) **hoặc** trong allowlist legacy. File mới ngoài layer mà không có trong allowlist sẽ fail: không viết thêm code kiểu cũ.
- **Allowlist** nằm ở một file duy nhất `scripts/arch/allowlist.ts` (entry kết thúc bằng `/` là cả thư mục). Khi chuyển xong một module, xóa phần của nó khỏi allowlist trong cùng PR. Entry không còn khớp file nào cũng làm `arch:check` fail, nên danh sách chỉ co lại. Mục tiêu cuối: rỗng.
- Thêm/sửa luật: sửa `scripts/arch/rules.ts` và thêm test fixture tương ứng.
- **Vỏ lắp ráp (P3-5):** `composition.ts`, `app.ts`, `index.ts`, `config.ts`, `app.test.ts` và `src/server/test/` (helper dựng cả app, test tích hợp HTTP ở `test/integration/`) thuộc layer `server/composition`: chỉ những file này được thấy mọi layer. Backend không còn entry nào trong allowlist; từ P5-3 allowlist rỗng hoàn toàn (`LEGACY_ALLOWLIST = []`), mọi file dưới `src/` phải nằm trong một layer.

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

_(Lịch sử P2-1; đã xử lý hết ở P3-x, `services/` không còn.)_ Code cũ từng dùng trực tiếp: `publish` toàn cục ở `services/{sessions,participants,attempts,grading}.ts` (13 chỗ); `new Date()` ở `services/*` và `auth/mentor.ts`; `randomBytes` ở `services/participants.ts` (token member) và `auth/mentor.ts` (salt, token mentor); `randomInt` truyền tay vào `shuffled`/`newRoomCode` ở `services/attempts.ts`, `services/room-code.ts`.

### 11.2 Module `sessions` (P3-1, issue #13)

- `domain/session/`: `Session`, `lifecycle.ts` (`assertTransition`, `planOpen/Start/Close/Finalize`: quy tắc chuyển trạng thái, thuần), `mode.ts` (strategy `SessionMode`: `SelfPacedMode`; `live` của phase 2 chỉ cần viết thêm một `SessionMode` và đăng ký vào `SessionModeRegistry`, không sửa use case), `room-code.ts`, `errors.ts` (đều là `DomainError`).
- `application/use-cases/sessions/`: `CreateSession`, `ListSessions`, `GetSessionDetail`, `GetActiveSession`, `GetLatestSession`, `OpenSession`, `StartSession`, `CloseSession`, `FinalizeSession` (bốn use case cuối gọi chung `transition-session.ts`: toàn bộ kiểm tra + đổi trạng thái là một unit, sự kiện phát sau commit).
- Port đọc/ghi: `SessionRepository` (chỉ trong unit), `SessionReader` (view cho màn hình mentor).
- **(Lịch sử P3-1; đã thay bằng use case thật ở P3-3/P3-4, adapter `Legacy*` đã xoá)** Cầu nối tới module chưa chuyển (`application/ports/session-repository.ts`): `AttemptAutoSubmitter` (nộp bài dở khi `close`) và `UngradedEssayCounter` (đếm tự luận chưa chấm khi `finalize`). Adapter `LegacyAttemptAutoSubmitter`/`LegacyUngradedEssayCounter` ở `infrastructure/db/drizzle-session-repository.ts` bọc `services/attempts.ts`, `services/grading.ts`. P3-3 và P3-4 thay bằng use case thật rồi xóa adapter. `DrizzleSessionReader.findDetail` cũng còn gọi `getSessionProgress` của attempts và đọc bảng `participants` trực tiếp, đổi ở P3-2/P3-3.
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

- `domain/attempt/`: `Attempt`, `Answer`, và quy tắc thuần trong `attempt.ts`: `assertCanStart` (một attempt/member/phiên), `planOrder` (trộn câu và đáp án bằng `RandomInt` truyền vào), `assertCanWork`, `validateAnswer` (400), `gradeAttempt` (chấm mọi câu, kể cả bỏ trống; tự luận `null`), `assertReviewable` (đáp án từ `closed`), `reviewState`, `memberAttemptState`, `computeProgress`/`NO_PROGRESS`, `countAnswered`/`showsAnsweredCount` (§7.26, dùng `shared/answered.ts`). Chấm điểm vẫn gọi `shared/scoring.ts` (web cũng dùng).
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

### 11.6 Module `ai-grading` (S26, PRODUCT.md §7.28)

Gợi ý chấm tự luận bằng cách gọi Claude CLI trên máy mentor. UI theo bản thiết kế "AI chấm nháp" (Design System 6).

- **Rubric** `src/shared/rubric.ts` (thuần, server và web dùng chung): `parseRubric(explanation, points)` tách các dòng danh sách kết thúc bằng điểm, ví dụ `- Nêu được X (1,5đ)` hoặc `(2 điểm)`, thành `criteria: { text, points }[]` và phần còn lại là `model` (đáp án mẫu). Trả `null` khi không có tiêu chí nào hoặc tổng điểm tiêu chí khác điểm câu. Có rubric (`hasRubric`) chỉ cần `explanation` có chữ; tách được tiêu chí chỉ giúp AI chấm theo T1…Tn và web hiện lưới tiêu chí.
- **Port** `application/ports/essay-grader.ts`: `EssayGrader.suggest(input): Promise<EssaySuggestion>`. `EssayGradingInput = { questionPrompt, questionBody, maxPoints, rubricText, rubricCriteria: { text, points }[] \| null, answerText }` (**không** có tên, email, id). `EssaySuggestion = { score, feedback, criteria: { label, score, max, note }[], suspicious, suspiciousReason, suspiciousLines, model }`. Lỗi ném `EssayGraderError` có `reason` (`unavailable` \| `timeout` \| `too_long` \| `bad_output` \| `process_failed`) và message tiếng Việt ngắn cho mentor ("Quá thời gian", "Bài quá dài để AI chấm", "Mất kết nối tới AI", "AI trả kết quả không hợp lệ"…). `EssayGrader.available()` cho `aiGrader.available`. Port `AiSuggestionRepository` (đọc/ghi bảng `ai_suggestions`) và `SuggestionQueue.enqueue(ids)`.
- **Domain** `domain/grading/ai-suggestion.ts` (thuần): `assertCanSuggest` (phiên `closed`, câu essay, có rubric, AI khả dụng), `pickAnswersToSuggest` (bài có chữ, chưa chấm tay, chưa có gợi ý hoặc gợi ý `failed`; với `answerIds` thì chỉ trong các bài đó), `normalizeSuggestion` (điểm trong [0, points] và bước 0,5, ngược lại `bad_output`; khi rubric tách được thì số tiêu chí phải bằng nhau và `max` lấy theo rubric; `suspiciousLines` lọc trong khoảng số dòng của bài).
- **Use case** `application/use-cases/grading/ai-suggestions.ts`: `RequestAiSuggestions` (ghi các dòng `queued` trong một unit rồi đưa id vào hàng đợi), `StopAiSuggestions`, `RunAiSuggestion` (chỉ chạy khi dòng còn `queued` và bài còn chưa chấm, nếu không thì xoá dòng; `running` → gọi port → `done`/`failed`), `ClearGrade`. `GradeAnswer` nhận thêm `aiUse` (ghi `used`) và xoá gợi ý `queued` của bài đó. `GetGradingView` đọc thêm gợi ý; `GetDiscussionView` **không** đọc. `GetAttemptReview` thêm `aiAssisted` theo từng câu.
- **Hàng đợi** `infrastructure/ai-grader/suggestion-queue.ts`: trong process, chạy lần lượt theo thứ tự xếp (số việc song song = `concurrency`, mặc định 1). Khi server khởi động, dòng `queued`/`running` còn sót chuyển `failed` ("Server đã khởi động lại"). Không retry tự động.
- **Adapter** `infrastructure/ai-grader/claude-cli-grader.ts`: `child_process.spawn(command, args, { shell: false, cwd: <thư mục tạm rỗng> })`. **Đề và bài làm đi qua stdin**, không bao giờ nằm trong tham số dòng lệnh. Chạy trong thư mục tạm rỗng để CLI không tự đọc `CLAUDE.md` hay file của repo (gồm `exams/`). Tham số = `cấu hình.args` của mentor + các tham số **app luôn thêm vào cuối**:
  `-p --tools "" --strict-mcp-config --disable-slash-commands --no-session-persistence --output-format json --json-schema <schema> --system-prompt <prompt>`.
  `--tools ""` = không có công cụ nào (không đọc file, không chạy lệnh), `--strict-mcp-config` không kèm `--mcp-config` = không có MCP server. Đã kiểm tên cờ trên Claude Code 2.1.326; khi dùng thật phải kiểm lại trên bản cài của mentor. Hết `timeoutSeconds` → kill tiến trình, `timeout`. Bài dài quá `maxAnswerChars` (mặc định 20 000) → `too_long`, không gọi CLI. Đọc kết quả JSON (`structured_output`, nếu không có thì parse `result`), validate bằng zod; sai → `bad_output`.
- **Prompt** `infrastructure/ai-grader/prompts.ts`: system prompt "giáo viên chấm bài" và hàm dựng prompt là **mã trong repo** (mentor không sửa). Bài làm đặt trong khối phân cách có đánh số dòng; nội dung trong khối là dữ liệu cần chấm, mọi câu trong đó nhắm vào người chấm phải bị bỏ qua và đánh dấu `suspicious` kèm số dòng. Chấm theo rubric, cho điểm từng tiêu chí (theo đúng thứ tự T1…Tn khi rubric tách được); `feedback` viết cho member, tiếng Việt, ngắn.
- **Cấu hình** (mentor tự sửa, không commit): file JSON, mặc định `config/ai-grader.local.json`; đổi đường dẫn bằng cờ `--ai-grader-config <file>` hoặc biến `AI_GRADER_CONFIG` (đọc trong `config.ts`). Repo commit `config/ai-grader.example.json`; `.gitignore` thêm `config/*.local.json`. Dạng:
  `{ "command": "claude", "args": ["--model", "sonnet", "--settings", "<đường dẫn>"], "timeoutSeconds": 120, "concurrency": 1, "maxAnswerChars": 20000 }`.
  Đọc lại mỗi lần dùng (sửa không cần restart). Không có file hoặc sai dạng → không khả dụng. Nội dung cấu hình không bao giờ được log hay trả qua API. App từ chối cấu hình có `--mcp-config`, `--tools`, `--allowedTools`/`--allowed-tools`, `--dangerously-skip-permissions`, `--allow-dangerously-skip-permissions`, `--add-dir`, `--plugin-dir`, `--agents`, `--permission-mode`, `--system-prompt*`, `--append-system-prompt*`, `--json-schema`, `--output-format`, `-p`/`--print`.
- **Đa nền tảng**: `spawn` với `shell: false` không chạy được file `.cmd`/`.bat` trên Windows (Node chặn). Adapter từ chối `command` dạng `.cmd`/`.bat` với thông báo hướng dẫn trỏ `command` tới `node` và `args` bắt đầu bằng đường dẫn `cli.js` của Claude Code (hoặc tới file `.exe`), không bao giờ bật `shell: true`.
- **Web**: `features/grading` theo bản thiết kế: dải điều khiển AI dưới thẻ câu dính (`ready`/`running`/`done`/`norubric`/`off`/`allgraded`/`final`), chip câu có chỉ báo, lọc Tất cả / Chờ xác nhận / Nghi ngờ / Lỗi, bài nghi ngờ chưa chấm ghim lên đầu, thẻ bài có khối gợi ý (viền đứt, "chưa phải điểm"), "Dùng gợi ý" một chạm + "Hoàn tác", "Sửa rồi lưu", bài nghi ngờ khoá "Dùng gợi ý" tới khi tick "Đã đọc toàn bộ bài" (trạng thái tick chỉ ở trình duyệt), phím `J`/`K`/`D`/`E`/`R`. Trang hướng dẫn bật `/admin/ai-grader-help` (tĩnh, không đọc cấu hình). Trang xem lại của member hiện một dòng khi `aiAssisted`.
- **Test**: adapter test bằng một script giả CLI (node) thay cho `command`; use case test bằng fake trong `application/testing/`. Không gọi AI thật trong `npm test`/`npm run e2e`.

### 11.7 Module `sharing` (S31, PRODUCT.md §7.33)

- **Domain** `domain/sharing/` (thuần): `assertCanShare(status)` (`closed`/`finalized`), `SMALL_CLASS_WARNING = 5` (chỉ để web cảnh báo mentor, không ẩn dữ liệu), dựng `SharedQuestion` từ câu hỏi + số đếm (chỉ trường đã liệt kê ở §5).
- **Port** `ShareTokenStore` (`get(): Promise<string \| null>`, `getOrCreate(candidate): Promise<string>` giữ token đang có nếu đã có, `replace(token)` cho "Đổi link"), adapter trên `app_meta`; sinh token qua port ngẫu nhiên sẵn có (như token participant).
- **Use case** `application/use-cases/sharing/`: `SetSessionShared`, `GetShareLink`, `RotateShareLink`, `ListSharedSessions`, `GetSharedSession`. Đếm lựa chọn dùng lại port đọc của thảo luận (§11.5) nếu đủ, không thì thêm một port đọc riêng; **không** đọc tên hay bài làm.
- **Route** `interface/http/sharing-routes.ts`, gồm hai plugin `sharingAdminRoutes` (trong `/api/admin`) và `sharedPublicRoutes` (công khai, `/api/shared`). Không phát event SSE (trang chia sẻ không cần realtime).
- **Web** `features/shared-sessions/{domain,application,infrastructure,ui}`; mentor bật/tắt và lấy link trong `features/session-admin`; dòng thông báo trong `features/member-review`.

### 11.8 Module `training` (S32–S36, PRODUCT.md §7.34)

Thu prompt và hoạt động công cụ của Claude Code qua hook HTTP. Kết quả thử kỹ thuật: [spikes/claude-code-hooks.md](spikes/claude-code-hooks.md).

- **Domain** `domain/training/` (thuần):
  - `nextTrainingStatus(status, action: 'stop' \| 'end')`: `open → stopped → ended`, không đi ngược.
  - `filterHookEvent(raw: unknown): TrainingEventDraft \| null`: whitelist, mọi trường khác bị bỏ (`transcript_path`, `cwd`, `scratchpad_dir`, `permission_mode`, `last_assistant_message`, …). `UserPromptSubmit` → `{ kind: 'prompt', prompt }`. `PostToolUse` / `PostToolUseFailure` → `{ kind: 'tool', toolName, ok, durationMs, toolTarget, errorExcerpt?, output?, change? }`. `toolTarget`: công cụ chạy lệnh (`Bash`, `PowerShell`, không phân biệt hoa thường, và mọi công cụ có `tool_input.command` là chuỗi) → `tool_input.command`; tool có `file_path`/`notebook_path`/`path` → đường dẫn **tương đối** so với `cwd` của hook (nằm ngoài `cwd` → chỉ tên file); tool khác → null. `output`: công cụ chạy lệnh → `stdout` + `stderr` (nếu `tool_response` không có cả hai thì giữ JSON gọn, không bỏ mất); **`Read` → không có output** (nội dung file bị bỏ ngay sau khi đếm số dòng; `toolTarget` thành `<đường dẫn> · N dòng`, PRODUCT.md §7.34c); tool khác → `tool_response` dạng chuỗi (JSON gọn nếu là object). `change`: `Edit` → khối `- <old_string>` / `+ <new_string>`; `Write` → `content`; tool khác → null. `errorExcerpt` = 20 dòng đầu của `error`. JSON sai dạng → null. Chốt khi cài (S33): loại sự kiện lấy từ `hook_event_name`, và suy ra từ các trường có mặt khi thiếu (`prompt` → prompt; `tool_name` + `error` → lỗi; `tool_name` → thành công; còn lại như `Stop` → null). `Write`/`Edit`/`MultiEdit`/`NotebookEdit` **không lưu output** (chỉ là xác nhận kèm đường dẫn tuyệt đối; việc đã làm nằm ở `change`). Mọi chuỗi giữ lại (`toolTarget`, `errorExcerpt`, output) bị thay phần `cwd` bằng đường dẫn tương đối (`cd /home/x/bai && ls` → `cd . && ls`), hiểu cả đường dẫn Windows. `isHookEvent(raw)` là kiểm tra rẻ cho buổi `stopped`.
  - `clip(text): Clip`: `CLIP_HEAD_LINES = 200`, `CLIP_TAIL_LINES = 200`, mỗi phần tối đa `CLIP_PART_BYTES = 32 KB`, dòng dài hơn 2 000 ký tự bị cắt. Ngắn hơn tổng hai phần → `tail = null`, `omittedLines = 0`. Áp cho `output` và `change` trước khi lưu. Hằng số chốt lại sau khi đo trên máy thật (checklist mục 8 của spike). Một phần quá 32 KB bị bỏ bớt dòng từ phía trong và phần bỏ được cộng vào `omittedLines`.
  - `isStuck(events)`: các sự kiện `tool` gần nhất của member có ≥ `STUCK_REPEAT = 3` lần **liên tiếp** thất bại với cùng `toolTarget` (prompt xen giữa không cắt chuỗi; một lần thành công thì cắt). Chỉ là cờ gợi ý, không phải điểm.
  - `connectionState(member)`: `uninstalled` nếu có `uninstalled_at` và không có `seen_after_stop_at` muộn hơn; `connected` nếu có `first_seen_at`; còn lại `waiting`. `stillSending` = `seen_after_stop_at` khác null và (chưa `uninstalled_at` hoặc `seen_after_stop_at` muộn hơn).
  - `buildHookSettings(baseUrl, ingestToken)`: object `{ hooks: { UserPromptSubmit, PostToolUse (matcher "*"), PostToolUseFailure (matcher "*") } }`, mỗi hook `{ type: 'http', url: baseUrl + '/api/training/ingest', headers: { 'X-Training-Token': ingestToken }, timeout: 1 }`. **Không** có `Stop` (chứa câu trả lời của Claude), không có hook `command`.
- **Ports** `application/ports/`: `TrainingRepository`, `TrainingMemberRepository`, `TrainingEventRepository` (S33 làm `append`, nằm trong `TrainingUnitContext.events` để ghi sự kiện và cập nhật `last_seen_at` trong **một** unit; S34 thêm phía đọc `TrainingEventReader`: `listLight(memberId, afterId, limit)`, `getDetail(eventId)` (kèm `trainingId` để kiểm sự kiện thuộc buổi trong URL), `recentTools(memberId, n)` (cũ → mới, `n = STUCK_REPEAT`), `countsByMember(trainingId)`). `isStuck` coi `toolTarget = null` là không bao giờ lặp lại (không biết có cùng việc hay không). `TrainingMemberRepository` thêm `findByIngestToken`, `recordSeen`, `recordSeenAfterStop`, `startUninstallCheck`, `finishUninstall`. Cấp mã phòng dùng chung với phiên: bộ cấp mã hiện có phải kiểm cả `trainings.room_code`.
- **Use case** `application/use-cases/training/`: `CreateTraining`, `ListTrainings`, `GetTrainingDetail`, `StopTraining`, `EndTraining`, `RemoveTrainingMember`, `JoinTraining`, `GetMyTraining`, `GetHookConfig`, `WithdrawTrainingConsent`, `StartUninstallCheck`, `FinishUninstallCheck`, `IngestHookEvent`, `ListMemberEvents`, `GetTrainingEventDetail`.
- **Route** `interface/http/training-routes.ts`: `trainingAdminRoutes` (trong `/api/admin`), `trainingMemberRoutes` (`/api/trainings/:id/join`, `/api/training/me*`, hook `requireTrainingMember` đọc `X-Training-Member-Token`), `trainingIngestRoute` (`bodyLimit` riêng 2 MB; không áp giới hạn lần sai của mã phòng). Ingest phát tín hiệu SSE qua bộ gộp `TRAINING_SIGNAL_THROTTLE_MS` (§7).
- **Web**: `features/training-admin/{domain,application,infrastructure,ui}` (mentor), `features/training-member/{…}` (member). `features/member-join` chỉ thêm: `resolve` trả `kind: 'training'` → chuyển tới `/training/:id` kèm mã. Hai feature không import nhau; component dùng chung (nếu có) vào `shared/ui/`. Liên kết "Buổi training AI" trong khung `/admin/*`.
- **Test**: domain `filterHookEvent` dùng các payload thật đã ghi trong spike (`PostToolUse` Bash/PowerShell/Write, `PostToolUseFailure`, `UserPromptSubmit`, `Stop` → null); tích hợp HTTP ingest + quét key cấm ở route member; không chạy Claude Code thật trong `npm test`/`npm run e2e` (e2e gửi JSON hook giả tới ingest).

### 11.9 Mở rộng `training` (S37–S40, PRODUCT.md §7.35; S37–S40 xong)

Contract dự kiến; story nào chạm thì chốt lại tại đây. Payload thật: [spikes/claude-code-hooks.md](spikes/claude-code-hooks.md) §6.

- **Hook thêm vào `buildHookSettings`** (S37, xong):
  - `PermissionRequest` (matcher `*`).
  - `Notification` (matcher `permission_prompt|idle_prompt`).
  - `PreCompact`, `SessionEnd`, `PostModelSwitch`.

  Vẫn **không** đăng ký `Stop` (câu trả lời của Claude) và `PostCompact` (`compact_summary` là tóm tắt do Claude viết). `SessionStart` không hỗ trợ HTTP.
- **Bất biến an toàn** (S37): ingest **không bao giờ** trả `hookSpecificOutput` hay `decision`. Với `PermissionRequest`, mọi trạng thái của buổi đều trả 204 body rỗng; buổi `stopped` không kèm `systemMessage` cho loại này. Có test HTTP khẳng định điều này. Lý do: body `{"hookSpecificOutput":{"decision":{"behavior":"allow"}}}` làm Claude tự duyệt trên máy member (spike §6.2).
- **`filterHookEvent` mở rộng** (S37):
  - Giữ thêm `permission_mode` và `prompt_id` (chỉ để gom theo lượt, không hiển thị).
  - Bỏ `scratchpad_dir`, và thay nó trong mọi chuỗi giữ lại giống như `cwd`.
  - Kind mới:
    - `permission` từ `PermissionRequest`: `toolName`, `toolTarget` và `change`, lọc như công cụ.
    - `session` từ các hook phiên: `subtype` là `clear` | `exit` (các `reason` khác của `SessionEnd`) | `compact_manual` | `compact_auto` | `model_switch`; `note` là `custom_instructions` của `/compact` hoặc `"<from> → <to>"`.
    - `notice` từ `Notification`: `subtype` là `waiting_permission` | `idle`. Bỏ `message`.
  - `AskUserQuestion` (kind `tool`): `toolTarget` = các câu hỏi, `note` = các cặp "câu hỏi → lựa chọn" lấy từ `tool_input.answers`.
  - `ExitPlanMode` (kind `tool`): `output` = `tool_response.plan`, chỉ tải khi mentor bấm "Xem".
- **Bảng `training_events`** thêm cột:
  - `permission_mode?`, `prompt_id?`, `subtype?`;
  - `note?`, giới hạn 2 000 ký tự.

  `kind` thêm các giá trị `permission`, `session`, `notice`. Migration bằng `npm run db:generate`.
- **Dừng gửi cần mentor duyệt xoá** (S38, §7.35j, xong):
  - `training_members` thêm `stopped_sending_at?`.
  - `WithdrawTrainingConsent` (buổi `open`) không xoá dòng nữa, chỉ ghi `stopped_sending_at`. Từ lúc đó ingest với token này bị đối xử như buổi `stopped`: không lưu, trả lời nhắc gỡ, ghi `seen_after_stop_at`.
  - Buổi `stopped`: không có nút dừng gửi.
  - `connection` thêm giá trị `stopped_sending`.
  - Route mentor mới `POST /api/admin/trainings/:id/members/:memberId/purge` xoá dòng member (cascade sự kiện), chỉ khi member có `stopped_sending_at`, khác thì trả 409.
  - Sau khi xoá, `GET /api/training/me` trả 401 (như mọi member đã bị xoá); màn member hiện "Đã xoá dữ liệu" nếu lần cuối biết họ đang ở `stopped_sending`.
  - `TrainingMemberRow.stoppedSending: boolean` để mentor luôn thấy ai đã dừng gửi.
- **Cờ gợi ý** (S39, xong; ngưỡng và ghi chú trong story S39):
  - Domain thuần `domain/training/flags/`, mỗi cờ một hàm `(events, ctx) → { code, eventIds[] } | null`. Hằng ngưỡng đặt cạnh từng hàm.
  - `isVerifyCommand(command)` nhận lệnh kiểm tra theo mẫu phổ biến; mentor không cấu hình.
  - `inferPermissionDecision(events)` suy ra cho mỗi sự kiện `permission`: `allowed` (có `tool` khớp `toolName` và `toolTarget` trước prompt kế tiếp), `denied`, hoặc `pending`, kèm `decisionMs` ước lượng.
  - `trainings` thêm `allow_auto_accept` (boolean, mặc định false, đặt khi tạo buổi).
  - `TrainingMemberRow` thêm `flags: FlagCode[]` và số đếm `clearCount`, `compactCount`, `permissionCount`.
  - Trang dòng thời gian trả thêm `flags: { code, eventIds }[]`; mỗi dòng `permission` có `decision` và `decisionMs`.
  - Tổng hợp lớp: `GET /trainings/:id` trả `flagCounts: Record<FlagCode, number>`, chỉ là số, không có tên.
- **Báo cáo** (S40):
  - Bảng `training_event_marks (event_id PK, cascade)`; `training_members` thêm `mentor_note?`; `trainings` thêm `report_exported_at?`.
  - `PUT|DELETE /api/admin/trainings/:id/events/:eventId/mark` (idempotent) và `PUT .../members/:memberId/note` (≤ 2000 ký tự); 409 khi buổi đã kết thúc. `TrainingEventRow.marked`, `TrainingMemberRow.mentorNote` và `markedCount`, `TrainingDetail.reportExportedAt`.
  - `GET /api/admin/trainings/:id/report.md` trả `text/markdown`: có `?preview=1` thì chỉ xem trước (không ghi `report_exported_at`), không có thì là file đính kèm và ghi lại lần xuất. Nội dung theo §7.35e; ví dụ đã đánh dấu chỉ có prompt, công cụ và đích, không có output, lỗi hay nội dung sửa.
  - `maskSecrets(text)` (domain, cùng `SECRET_PATTERNS` với cờ `possible_secret`) che chuỗi giống khoá hoặc mật khẩu; `buildReport` chạy nó trên toàn bộ văn bản ở bước cuối.
  - Dấu, ghi chú và báo cáo đều bị xoá khi Kết thúc.

### 11.10 Xuất dữ liệu training để phân tích (S41, PRODUCT.md §7.36; xong)

- **Không thêm thư viện**: `NodeZipWriter` (`infrastructure/system/node-zip-writer.ts`) tự ghi zip thường (không Zip64) bằng `node:zlib` `deflateRawSync` và CRC32 tự tính, sau port `ArchiveWriter` (`application/ports/archive-writer.ts`). Đã kiểm với `unzip` của Linux; **chưa thử** Windows Explorer, macOS Archive Utility. Gặp lỗi tương thích ở đó thì dừng và đề xuất thư viện, cập nhật §1.
- `GET /api/admin/trainings/:id/export/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&members=1,2` → `TrainingExportSummary` `{ from, to, memberCount, eventCount, approxBytes, tooLarge }` (`from`/`to` là các ngày đã dùng sau mặc định) để hiện trước khi tải. Bỏ `members` là cả lớp; bỏ cả `from` và `to` là hôm nay; chỉ có `from` là một ngày; chỉ có `to` là 400. Schema zod `TrainingExportQuery` ở `src/shared/api/training.ts`.
- `GET /api/admin/trainings/:id/export.zip?…` (cùng tham số) → `application/zip`, file đính kèm. Không có sự kiện nào của các bạn được chọn trong khoảng → 404 (`code: empty_export`); buổi `ended` → 409; member không thuộc buổi → 404; `from` > `to`, ngày sai định dạng, `members` sai → 400; vượt `TRAINING_EXPORT_MAX_BYTES` (200 MB trước nén) → 400 (`code: export_too_large`).
- Ngày tính theo **giờ địa phương của máy chạy server** (= máy mentor): `from` 00:00 đến hết ngày `to`.
- Domain thuần (`domain/training/export.ts`, `export-range.ts`): `buildExportFiles(...)` dựng `00-tong-quan.md` và file từng member; `resolveExportRange` đổi ngày thành `[from, to)` theo giờ địa phương; `slugifyFileName(index, displayName)` → `03-nguyen-van-an.md` (bỏ dấu, `đ` → `d`, chỉ `[a-z0-9-]`, rỗng thì `member`); toàn bộ văn bản qua `maskSecrets` ở bước cuối như báo cáo S40.
- Khác `report.md` (§11.9): có output và nội dung sửa file; không ghi `report_exported_at`.

## 12. Web: hạ tầng dùng chung (P4-1, issue #18)

Các port phía web nằm ở `src/web/shared/`, implementation được chọn tại `src/web/app/composition.ts` (composition root phía web).

| Thành phần | Vị trí | Ghi chú |
|---|---|---|
| Lõi HTTP | `shared/api-client/http-client.ts` | `createHttpClient({ interceptors, fetch })`, `ApiError`. Không biết token là gì. |
| Gắn token | `shared/api-client/participant-auth.ts` | Interceptor `participantAuth(store)` thêm header `X-Participant-Token`. Quy ước path (`/api/sessions/:id/...`, `/api/me/...`) nằm riêng ở `sessionIdForPath`, không còn trong lõi. |
| Port `TokenStore` | `shared/token-store/` | `LocalStorageTokenStore` (không bao giờ throw, giữ nguyên key `pq:participant:<id>` và `pq-current-session`), `InMemoryTokenStore` cho test. |
| Port `EventStream` | `shared/events/event-stream.ts` | Implementation SSE `sse-event-stream.ts`: một `EventSource` cho mỗi phiên mỗi tab, tự gọi lại handler sau khi kết nối lại. |

- **Module-level, không dùng React context** cho composition: hub SSE phải là một cho cả tab (trình duyệt giới hạn ~6 kết nối HTTP/1.1 mỗi origin), (và để code không-React import thẳng được mà không cần provider). Feature nhận gateway của mình qua React context (`app/AppProviders.tsx`, P4-2) nên `ui` không import `infrastructure`; test dựng bản riêng với fake.
- (Lịch sử) `lib/api.ts` và `lib/useSessionEvents.ts` từng là lớp mỏng cho page cũ; đã xoá ở P5-3.
- Hạn chế đã biết: việc chọn session theo path vẫn là quy ước ngầm, nhưng đã tách khỏi lõi và có test. Khi page chuyển sang gateway truyền `sessionId` tường minh thì interceptor này có thể bỏ.

### 12.1 Feature mẫu: `member-exam` (P4-2, issue #19)

Màn làm bài của member (`features/member-exam/`). Các feature sau bắt chước cấu trúc này.

| Lớp | File | Vai trò |
|---|---|---|
| `domain` | `answer-progress.ts` | Thuần: bản nháp (`Drafts`), `nextSelection` (single thay, multi bật/tắt), `progressOf`. |
| | `shortcuts.ts` | Thuần: `shortcutFor(key…)` trả hành động; luật tắt khi đang gõ / mở hộp thoại / có Ctrl-Alt-⌘. |
| `application` | `exam-gateway.ts` | Port `ExamGateway` (`startAttempt/getAttempt/saveAnswer/submitAttempt`). |
| | `answer-saver.ts` | Engine autosave (debounce, một request mỗi câu, retry 2s/5s/10s, `flushAll`). |
| | `taking-controller.ts` | `TakingController`: lớp TS thuần giữ state (`getState/subscribe`), gọi gateway + `AnswerSaver`, xử lý 409 (phiên đóng) và nộp bài. Test bằng gateway giả, không cần render. |
| | `use-taking-exam.ts`, `exam-gateway-context.tsx` | Nối controller vào React (`useSyncExternalStore`), cấp gateway qua context. |
| `infrastructure` | `http-exam-gateway.ts` | `ExamGateway` trên `HttpClient` (cùng endpoint `/api/me/*`). |
| `ui` | `MemberExamPage` (+ `StartScreen`, `TakingView`, `ResultView`, `QuestionContent`, `TakingDesktop/Phone`, `ExamParts`, `use-exam-shortcuts`) | Chỉ render và gọi controller; không import `infrastructure`. |

Dùng chung (3 page cùng dùng) nằm ở `shared/`: `hooks/{useMediaQuery,useOnline,useKeyboardOpen}`, `format/points.ts`, `ui/member/{MemberLayout,member-shell,question-nav,Switch,breakpoints,review-mark}`.

Còn để lại cho P5-3 vì thuộc luồng khác: `lib/member-screen.ts` (chọn màn ở `/` = `member-join`), `retrySecondsFrom`, `reviewMark`, `notCorrectIndexes` (review).

### 12.2 Feature `discussion` (P5-1, issue #20)

Màn thảo luận trên máy chiếu (`features/discussion/`), theo mẫu §12.1.

| Lớp | File | Vai trò |
|---|---|---|
| `domain` | `discussion-ui.ts`, `grade-draft.ts`, `shortcuts.ts` | Thuần: tách bài/bài trống, "nhầm phổ biến", bài chưa chấm kế tiếp; thứ tự "Cần bàn trước" `priorityOrder` (S28, §7.30); bản nháp điểm và `planSave` (chờ điểm / sai / không đổi / gửi); bản đồ phím `discussionKeyAction`. |
| `application` | `discussion-gateway.ts`, `discussion-controller.ts`, `use-discussion.ts` | Port; `DiscussionController` giữ state (đã hiện đáp án, chế độ danh sách/bài, bản nháp, hộp thoại chốt) và các thao tác chấm/chốt; test bằng gateway giả. Câu hỏi đang xem lấy từ URL `?q=` (luôn là số câu theo đề gốc), thứ tự điều hướng từ `?order=priority` (S28), nên UI truyền câu hiện tại vào thao tác cần nó. |
| `infrastructure` | `http-discussion-gateway.ts` | Cùng endpoint `/api/admin/...`. |
| `ui` | `DiscussionPage` (container) + `DiscussionScreen` (khung), `ChoiceView`, `EssayList`, `PaperView`, `StateView`, `EssayCard`, `OptionTally`, `ScoreField`, `use-discussion-keys` | Chỉ render và gọi controller. |

Quyết định về `components/screen/*` và các thành phần chung: `ScreenStage`, `ScreenLayout` (cả màn chiếu `ScreenPage` dùng) vào `shared/ui/screen/`; `QuestionNav`, `SaveIndicator` (hai feature dùng) vào `shared/ui/`; `EssayCard`, `OptionTally`, `ScoreField` chỉ thảo luận dùng nên ở trong feature. `parseScore` (luật điểm theo bước 0,5, cả chấm bài và thảo luận) ở `shared/grading/score.ts`; `useFullscreen` ở `shared/hooks/`.

### 12.3 Features `session-admin` và `grading` (P5-2, issue #21)

Phía mentor, theo mẫu §12.1.

- **`features/session-admin/`** (danh sách + tạo phiên, trang điều khiển, xem lại phiên): `domain/{session-ui,session-review}` (hành động kế tiếp theo trạng thái, nhãn tiến độ, thống kê); `application/` gồm port `SessionAdminGateway`, `SessionDetailController` (hành động vòng đời, duyệt/kick/đổi tên, bỏ phản hồi refetch cũ hơn), loader cho router (`createSessionAdminLoaders(gateway)`), hook `useSessionDetail` (refetch theo SSE), `useCreateSession`, `useParticipantReview`; `infrastructure/http-session-admin-gateway.ts`; `ui/` các page và card.
- **`features/grading/`** (chấm tự luận): `domain/{grading-ui,card-save}` (`planCardSave`: không làm gì / báo lỗi / khôi phục điểm đã chấm / gửi); `application/` gồm port `GradingGateway`, `GradingController` (chấm một bài, chấm 0 bài trống, chốt), `createGradingLoader`, `useGrading`; `infrastructure/http-grading-gateway.ts`; `ui/`.
- **Loader của router** nằm ở `application` và được gắn gateway tại `router.tsx` (`createSessionAdminLoaders(sessionAdminGateway)`), nên `ui` vẫn không biết `infrastructure`.
- **SSE qua context:** `useSessionEvents` chuyển sang `shared/events/use-session-events.tsx`, lấy `EventStream` từ `EventStreamProvider` (`app/AppProviders.tsx`); không còn import singleton trực tiếp.
- Hai feature không import nhau: luật chấm điểm dùng chung (`parseScore`) ở `shared/grading/score.ts`; mỗi feature có gateway riêng dù một vài endpoint trùng (rẻ hơn một abstraction chung).

### 12.4 Phần web còn lại và dọn dẹp (P5-3, issue #22)

Thêm các feature, mỗi feature đủ 4 lớp, gateway riêng, test controller/domain bằng fake:

| Feature | Thay cho | Điểm đáng chú ý |
|---|---|---|
| `exam-import` | `ExamImport`, `ExamList`, `ExamDetail` | `ImportController` (preview debounce, bỏ phản hồi cũ, chặn nộp đúp), loader gắn gateway ở `router.tsx`, `useDeleteExam`. |
| `member-join` | `MemberHome` | `MemberHomeController` (poll + SSE, theo dõi phiên đang mở hoặc phiên vừa tham gia, 401 xoá token, 403 bị kick, phát hiện nộp tự động), `decideScreen`, `classifyJoinError`; cổng `MemberGateway` + `RoomCodeMemory` + `MySessionsStore` ("Phiên của bạn trên máy này", PRODUCT.md §7.29: `LocalStorageMySessionsStore`, key `pq-my-sessions`; trạng thái lấy từ `GET /api/sessions/:id/public`); token qua `TokenStore`. |
| `member-review` | `ReviewPage` | `reviewMark`, `notCorrectIndexes`, `useReview`. |
| `screen` | `ScreenPage` | `ScreenController` (theo phiên mới nhất, tự chuyển phiên, poll + SSE). |
| `admin-auth` | `AdminLogin` + guard trong router | `createAdminAuthLoaders` (`requireLogin`, `login`), `setupPasswordProblem`. |
| `mentor-notices` | chuông thông báo | `domain/mentor-notices`, `useMentorNotices` (cổng gateway + `SeenStore`), `useDesktopNotify` ở `ui` (API trình duyệt). |

- **Ghép feature ở `app/`, không import chéo:** `MemberHomePage` nhận `examScreen` (render prop); `app/router.tsx` truyền `MemberExamPage`. Mọi gateway được cấp qua context ở `app/AppProviders.tsx`; `app/composition.ts` là nơi duy nhất `new` implementation.
- **`shared/` nhận cái dùng chung thật sự:** UI kit (`shared/ui/*`, từ `components/ui`), `Markdown`, `AnswerOption`, `QuestionPreview`, `ReviewQuestions`, `ResultView`; `leaderboard/` (`LeaderboardView` thuần + `Leaderboard` có gateway/SSE); `room/` (`room-code`, `useJoinHost(fetchHosts)`); `format/` (`points`, `date`).
- **`app/`:** `main.tsx` (điểm vào Vite, `index.html` trỏ tới đây), `router.tsx`, `AdminLayout.tsx`, `composition.ts`, `AppProviders.tsx`.
- Đã xoá hẳn `src/web/pages`, `lib`, `components`, `layouts`, facade `lib/api.ts` (test hành vi của nó nằm ở `http-client`, `participant-auth`, `token-store`).

