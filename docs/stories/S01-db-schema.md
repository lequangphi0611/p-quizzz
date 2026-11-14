# S01 — DB schema + migrate

**Phụ thuộc:** — · **Song song với:** S02

## Bối cảnh
Mọi story backend dựa trên schema này. Contract: [architecture.md §2](../architecture.md#2-data-model).

## Phạm vi
- Khai báo đủ các bảng §2 trong `src/server/db/schema.ts` (giữ `app_meta`), kèm relations Drizzle, index/unique như mô tả.
- Sinh migration bằng `npm run db:generate`, commit thư mục `src/server/db/migrations/`.
- `createDb()` chạy migrate tự động (`migrate()` của `drizzle-orm/better-sqlite3/migrator`) — áp dụng cả cho `:memory:` để test có schema.
- Test helper `src/server/test/helpers.ts`: `createTestApp()` trả về `{ app, db }` với DB `:memory:` đã migrate; `seedExam(db, overrides?)` tạo nhanh 1 đề có 1 câu single, 1 multi, 1 essay.

## Ngoài phạm vi
API, logic nghiệp vụ.

## Acceptance criteria
- [x] Server khởi động trên DB mới tạo đủ bảng; khởi động lại không lỗi (migrate idempotent).
- [x] Unique `(attempt_id, question_id)` trên `answers`; unique `token` trên `participants`.
- [x] Foreign key bật (`foreign_keys = ON`); xoá exam cascade xoá questions/options (sessions **không** cascade — chặn ở tầng API).
- [x] Cột điểm đạt được là `real`, `points` là integer (architecture §2).
- [x] Cột JSON (`question_order`, `option_order`, `selected_option_ids`) dùng `text({ mode: 'json' }).$type<...>()` có type đúng.

## Test bắt buộc
- Migrate trên `:memory:` tạo đủ bảng (query `sqlite_master`).
- Vi phạm unique `answers(attempt_id, question_id)` ném lỗi.
- `seedExam` tạo đúng số question/option.
