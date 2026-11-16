# S06 — API vòng đời phiên

**Phụ thuộc:** S01, S03 · **Song song với:** S04

## Bối cảnh
Phiên thi tách khỏi đề; vòng đời `draft → lobby → running → closed → finalized`. Contract: [architecture.md §3, §5 (sessions)](../architecture.md).

## Phạm vi
- `src/shared/session-state.ts`: `nextStatus()` thuần như §3.
- Service `src/server/services/sessions.ts` + route: `POST/GET /api/admin/sessions`, `GET /api/admin/sessions/:id`, `POST /api/admin/sessions/:id/{open,start,close,finalize}`.
- Ràng buộc tối đa 1 phiên `lobby`/`running` khi `open`.
- `close`: hiện chỉ đổi status + set `closed_at`; nếu đề không có tự luận thì chuyển tiếp `finalized`. **Tự nộp attempt dở** và **điều kiện finalize về chấm tự luận** để lại hook rõ ràng (hàm `onSessionClosing(db, sessionId)` / `canFinalize(db, sessionId)` trả về true) — S11 và S15 sẽ hiện thực.
- Mỗi lần đổi trạng thái gọi `publish(sessionId, 'session')` nếu S07 đã có; nếu chưa, để TODO gọi qua một hàm `notify` no-op.
- `GET /api/sessions/active` (công khai).
- `GET /api/admin/sessions/:id` trả session + exam (title, hasEssay, totalPoints) + participants (mảng rỗng cho tới S08).

## Acceptance criteria
- [x] Chuyển trạng thái sai thứ tự → 409 với thông báo tiếng Việt nêu trạng thái hiện tại.
- [x] `open` khi đã có phiên hoạt động → 409 "Đang có phiên thi khác hoạt động".
- [x] Mở 2 phiên khác nhau từ cùng 1 đề được (tuần tự).
- [x] Mỗi mốc `opened_at/started_at/closed_at/finalized_at` được set đúng lúc.

## Test bắt buộc
- Bảng chuyển trạng thái đầy đủ cho `nextStatus` (mọi cặp hợp lệ + không hợp lệ).
- API: luồng đầy đủ draft→finalized cho đề thuần trắc nghiệm (close tự finalize) và đề có tự luận (dừng ở closed).
- Ràng buộc 1 phiên hoạt động.
