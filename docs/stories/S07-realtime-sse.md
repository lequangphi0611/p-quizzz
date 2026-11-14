# S07 — Realtime SSE

**Phụ thuộc:** S01, S02 · **Song song với:** S03

## Bối cảnh
Lobby và màn hình chiếu cần cập nhật tức thì. Contract: [architecture.md §7](../architecture.md#7-realtime-sse).

## Phạm vi
- `src/server/events.ts`: event bus trong process (`publish`, `subscribe` trả hàm unsubscribe), type `SessionEventType = 'session' | 'participants' | 'leaderboard'` đặt ở `src/shared/api/events.ts`.
- Route `GET /api/sessions/:id/events`: header SSE, heartbeat `: ping` mỗi 20s, dọn listener khi client ngắt (`request.raw.on('close')`). Dùng `reply.hijack()` + ghi `reply.raw`.
- Web: `src/web/lib/useSessionEvents.ts` — `useSessionEvents(sessionId | null, { session?, participants?, leaderboard? })`, tự đóng khi unmount, dựa vào cơ chế reconnect của `EventSource`; khi reconnect thành công gọi **tất cả** handler một lần (đề phòng lỡ event lúc mất kết nối).
- Trang demo tạm không cần; viết test.

## Acceptance criteria
- [x] 2 client cùng subscribe 1 session đều nhận event; client session khác không nhận.
- [x] Ngắt client → listener bị gỡ (không rò rỉ).
- [x] Event không chứa dữ liệu nghiệp vụ (`data: {}`).
- [x] Hoạt động qua Vite proxy khi `npm run dev` (kiểm tay; nếu proxy buffer, cấu hình lại proxy trong `vite.config.ts`).

## Test bắt buộc
- Unit test event bus (publish/subscribe/unsubscribe, cô lập theo session).
- Test route: mở kết nối thật (`app.listen({ port: 0 })` + `fetch` đọc stream), publish, nhận đúng chuỗi `event: participants`.
