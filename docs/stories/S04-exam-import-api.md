# S04 — API import đề

**Phụ thuộc:** S01, S03

## Bối cảnh
Mentor import file Markdown đã duyệt. Parser có sẵn: `src/shared/exam-format` (không viết parser mới). Contract: [architecture.md §5 (exams)](../architecture.md), format: [exam-format.md](../exam-format.md).

## Phạm vi
- Route `POST /api/admin/exams/preview`, `POST /api/admin/exams`, `GET /api/admin/exams`, `GET /api/admin/exams/:id`, `DELETE /api/admin/exams/:id`.
- Tạo exam: parse lại phía server (không tin dữ liệu client), ghi exam + questions + options trong **một transaction**, lưu `source_markdown`.
- Giới hạn body 1 MB.
- Schema zod + type response ở `src/shared/api/exams.ts`.

## Acceptance criteria
- [x] Markdown có lỗi → 400 `{ error: 'Đề có lỗi, chưa import được', errors: ExamIssue[] }`, DB không đổi.
- [x] Import `exams/examples/git-co-ban.md` → đúng 4 câu, đúng type/points/position, options đúng `is_correct`.
- [x] `GET /exams` trả `{ id, title, description, questionCount, totalPoints, hasEssay, createdAt, sessionCount }`, mới nhất trước.
- [x] `DELETE` khi đã có session dùng → 409 "Đề đã được dùng cho phiên thi, không xoá được".
- [x] Không có API sửa đề (đề bất biến).

## Test bắt buộc
- preview trả đúng `ParseResult` cho file lỗi và file hợp lệ.
- Tạo từ file mẫu, đọc lại chi tiết khớp.
- Lỗi giữa transaction không để lại dữ liệu dở (mô phỏng bằng cách làm hỏng một insert).
- Xoá bị chặn khi có session.
