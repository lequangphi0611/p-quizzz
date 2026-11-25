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
| [S21](S21-groups-email.md) | Nhóm học viên và phiên giới hạn theo email | S20 | ✅ |
| [S22](S22-rejoin-request.md) | Xin vào lại khi email/tên đã có người vào | S21 | ✅ |
| [S23](S23-score-visibility.md) | Ẩn/hiện điểm theo phiên + giờ nộp cho mentor | S09, S13, S14, S18 | ✅ |
| [S24](S24-answered-progress.md) | Tiến độ làm bài (số câu đã trả lời) cho mentor | S09, S11 | ✅ |
| [S25](S25-time-limit.md) | Giới hạn thời gian làm bài (đồng hồ chung, tự đóng phiên) | S04, S06, S09, S12, S14, S18 | ✅ |
| [S26](S26-ai-grading-suggestion.md) | Gợi ý chấm tự luận bằng AI (Claude CLI trên máy mentor) | S15, S16, S17 | ✅ |
| [S27](S27-return-to-ended-session.md) | Quay lại kết quả phiên đã kết thúc ("Phiên của bạn trên máy này") | S16, S18, S20 | ✅ |
| [S28](S28-discussion-priority-order.md) | Xếp câu "Cần bàn trước" trong chế độ thảo luận | S17 | ✅ |
| [S29](S29-session-start-modes.md) | Bắt đầu phiên: thủ công / hẹn giờ / khi mọi người sẵn sàng | S09, S10, S12, S14, S18, S20, S21, S25 | ✅ |
| [S30](S30-choice-reason.md) | Ô lý do cho câu trắc nghiệm (bắt buộc khi đánh dấu, không tính điểm) | S04, S11, S12, S16, S17, S18, S24, S25 | ✅ |
| [S31](S31-shared-sessions.md) | Trang chia sẻ các phiên đã thi (một link chung, chỉ đề + lời giải + tỉ lệ chọn) | S16, S17, S18, S20 | ✅ |
| [S32](S32-training-api.md) | Buổi training AI: tạo / dừng thu / kết thúc, member vào + đồng ý, cấu hình hook | S03, S20 | ✅ |
| [S33](S33-training-ingest.md) | Nhận sự kiện hook (ingest), lọc + cắt output, trạng thái kết nối, kiểm tra gỡ | S32 | ✅ |
| [S34](S34-training-mentor-view-api.md) | API xem dữ liệu training cho mentor: dòng thời gian, output khi cần, cờ kẹt | S33 | ✅ |
| [S35](S35-training-mentor-ui.md) | UI mentor: buổi training AI | S34 | ✅ |
| [S36](S36-training-member-ui.md) | UI member: vào buổi training, đồng ý, cài và gỡ hook | S32, S33 | ✅ |
| [S37](S37-training-capture-more.md) | Training: thu thêm phiên, xin quyền, câu hỏi và kế hoạch của Claude | S33, S36 | ✅ |
| [S38](S38-training-stop-sending.md) | Training: member dừng gửi, mentor duyệt xoá dữ liệu | S35, S36 | ✅ |
| [S39](S39-training-flags-timeline.md) | Training: cờ gợi ý và các dòng mới trên dòng thời gian | S37 | ✅ |
| [S40](S40-training-report.md) | Training: đánh dấu ví dụ, ghi chú, xuất báo cáo trước khi kết thúc | S38, S39 | ✅ |
| [S41](S41-training-export.md) | Training: xuất dữ liệu thô (zip, mỗi member một file) theo ngày để phân tích bằng AI cá nhân | S40 | ✅ |
| [S42](S42-training-multi-day.md) | Training nhiều ngày: nhóm theo ngày (mới nhất ở trên, thu gọn) trên dòng thời gian | S35, S39, S40, S41 | ✅ |
| [S43](S43-training-session-blocks.md) | Training: gom theo phiên Claude Code (kể cả song song) trong ngày, cờ theo phiên, đánh dấu prompt mới | S39, S41, S42 | ✅ |
| [S44](S44-training-teaching-examples.md) | Training: xuất ví dụ prompt tốt / chưa tốt giấu tên để dạy khoá sau | S40, S43 | ✅ |
| [S45](S45-training-example-ai-draft.md) | Training: AI điền nháp ví dụ prompt, học từ ví dụ mentor đã chốt trong buổi (chạy nền) | S26, S44 | ⏳ chờ thiết kế |

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

Đợt 8 (sau MVP, theo bản thiết kế UI của đợt này): S20 → S21 → S22 làm **tuần tự** (S21 dựa vào tra phiên theo mã của S20; S22 dựa vào danh tính email của S21). Phần API/domain của mỗi story làm được trước, UI chờ bản thiết kế.

Các story trong cùng đợt chạm file khác nhau là chính; nếu cùng sửa `src/server/app.ts` (đăng ký route) hoặc router web thì merge tay phần đăng ký — đó là xung đột dự kiến, không phải lỗi.

Đợt 9 (buổi training AI, PRODUCT.md §7.34): S32 → S33 → S34 làm **tuần tự** (server). Trước S33 nên chạy checklist máy thật trong [spikes/claude-code-hooks.md §5](../spikes/claude-code-hooks.md): kết quả có thể đổi contract ingest. S35 (cần S34) và S36 (cần S33) làm **song song** sau khi có bản thiết kế UI.

Đợt 10 (training: thấy rõ cách làm việc với Claude, PRODUCT.md §7.35): S37 và S38 làm **song song** (S37 chạm ingest và màn đồng ý; S38 chạm luồng dừng gửi; cùng sửa câu chữ màn đồng ý nên phải thống nhất trước). Sau đó làm S39, rồi S40. S40 cần designer nhẹ.

Đợt 11 (training: xuất dữ liệu để phân tích, PRODUCT.md §7.36): S41, một story, chạm phần xuất của S40 và màn đồng ý của S36/S37.

Đợt 12 (training: phiên song song và đánh dấu mới, PRODUCT.md §7.38): S43. Phần 1 (dữ liệu đúng: cờ, zip, gom lượt theo phiên ở domain) làm trước; phần 2 (UI khối phiên + đánh dấu mới) chờ thiết kế được PO duyệt.

Đợt 13 (training: ví dụ dạy khoá sau, PRODUCT.md §7.39): S44, một story, chạm màn đồng ý và phần xuất.

Đợt 14 (training: AI điền nháp ví dụ, PRODUCT.md §7.40): S45, một story, tách runner Claude CLI của S26 và thêm vào hộp thoại ví dụ của S44. PO: code sau khi có bản thiết kế được duyệt.

**Mốc dùng thử được với member thật:** xong đợt 6 (chưa có màn hình chiếu và xem lại bài).
