# Stories — MVP

Mỗi story là một file tự đủ ngữ cảnh để một model/người implement độc lập.

## Trước khi bắt đầu một story

1. Đọc `CLAUDE.md`, [PRODUCT.md](../PRODUCT.md), [architecture.md](../architecture.md) (contract), rồi file story.
2. Code mới theo [how-to-add-a-feature.md](../how-to-add-a-feature.md) (layering `architecture.md` §9). Đường dẫn trong các file story là **lịch sử** (viết trước refactor epic #7); cấu trúc hiện hành ở `architecture.md` §9, §11, §12.
3. Kiểm tra mọi story trong mục **Phụ thuộc** đã ✅ ở bảng dưới. Chưa xong → không làm.
4. Làm trên branch riêng `story/sXX-<slug>`.

## Quy tắc khi implement

- **Chỉ làm trong phạm vi story.** Thấy việc cần làm ngoài phạm vi → ghi vào báo cáo, không tự làm.
- **Không tự đổi contract** (`architecture.md`: schema, API, tên event, thư viện). Contract sai/thiếu → dừng và báo. Nếu bắt buộc phải đổi để hoàn thành → sửa `architecture.md` trong cùng commit và nêu rõ trong báo cáo.
- Không thêm thư viện ngoài danh sách §1 của architecture.md nếu story không cho phép.
- UI text tiếng Việt; code/comment tiếng Anh.

## Definition of Done (mọi story)

- [ ] Tất cả acceptance criteria đạt.
- [ ] Test bắt buộc trong story đã viết và pass; `npm test`, `npm run typecheck` và `npm run arch:check` pass toàn bộ.
- [ ] Story có UI: đã chạy `npm run dev` và tự thao tác luồng chính (ghi lại đã kiểm những gì).
- [ ] Cập nhật bảng trạng thái dưới đây (✅) và tick checkbox trong file story.
- [ ] Báo cáo ngắn: đã làm gì, lệch contract chỗ nào (nếu có), việc phát sinh ngoài phạm vi.

## Trạng thái & phụ thuộc

| Story | Tên | Phụ thuộc | Trạng thái |
|---|---|---|---|
| [S01](S01-db-schema.md) | DB schema + migrate | — | ✅ |
| [S02](S02-web-foundation.md) | Nền tảng web | — | ✅ |
| [S03](S03-mentor-auth.md) | Xác thực mentor | S01, S02 | ✅ |
| [S04](S04-exam-import-api.md) | API import đề | S01, S03 | ✅ |
| [S05](S05-exam-import-ui.md) | UI import & quản lý đề | S04 | ✅ |
| [S06](S06-session-lifecycle-api.md) | API vòng đời phiên | S01, S03 | ✅ |
| [S07](S07-realtime-sse.md) | Realtime SSE | S01, S02 | ✅ |
| [S08](S08-join-participants-api.md) | API vào phiên & quản lý người tham gia | S06, S07 | ✅ |
| [S09](S09-mentor-session-ui.md) | UI điều khiển phiên (mentor) | S05, S08 | ✅ |
| [S10](S10-member-join-ui.md) | UI vào phiên & phòng chờ (member) | S08 | ✅ |
| [S11](S11-attempt-api.md) | API làm bài & chấm tự động | S08 | ✅ |
| [S12](S12-exam-taking-ui.md) | UI làm bài | S10, S11 | ✅ |
| [S13](S13-leaderboard.md) | Bảng xếp hạng (API + UI member) | S11 | ✅ |
| [S14](S14-projector-screen.md) | Màn hình chiếu | S13 | ✅ |
| [S15](S15-essay-grading.md) | Chấm tự luận & chốt phiên | S11, S09 | ✅ |
| [S16](S16-review-after-close.md) | Xem lại bài sau khi đóng phiên | S12 | ✅ |
| [S17](S17-discussion-mode.md) | Chế độ thảo luận sau phiên | S13, S15, S16 | ✅ |
| [S18](S18-member-responsive-ui.md) | Giao diện học viên cho máy tính + điện thoại | S10, S12, S16 | ✅ |
| [S19](S19-edit-request.md) | Xin sửa bài tự luận sau khi nộp | S11, S12, S09 | ✅ |
| [S20](S20-parallel-sessions.md) | Nhiều phiên chạy song song | S06, S08, S09, S10, S14 | ✅ |
| [S21](S21-groups-email.md) | Nhóm học viên và phiên giới hạn theo email | S20 | ⬜ (UI chờ designer) |
| [S22](S22-rejoin-request.md) | Xin vào lại khi email/tên đã có người vào | S21 | ⬜ (UI chờ designer) |

## Thứ tự & song song

```
Đợt 1:  S01 ─┬─ S02            (song song)
Đợt 2:  S03 ─┬─ S07            (song song)
Đợt 3:  S04 ─┬─ S06            (song song)
Đợt 4:  S05 ─┬─ S08            (song song)
Đợt 5:  S09 ─┬─ S10 ─┬─ S11    (song song)
Đợt 6:  S12 ─┬─ S13 ─┬─ S15    (song song)
Đợt 7:  S14 ─┬─ S16            (song song)
```

Đợt 8 (sau MVP, theo [group-sessions-ui-prompt.md](../design/group-sessions-ui-prompt.md)): S20 → S21 → S22 làm **tuần tự** (S21 dựa vào tra phiên theo mã của S20; S22 dựa vào danh tính email của S21). Phần API/domain của mỗi story làm được trước, UI chờ bản thiết kế.

Các story trong cùng đợt chạm file khác nhau là chính; nếu cùng sửa `src/server/app.ts` (đăng ký route) hoặc router web thì merge tay phần đăng ký — đó là xung đột dự kiến, không phải lỗi.

**Mốc dùng thử được với member thật:** xong đợt 6 (chưa có màn hình chiếu và xem lại bài).
