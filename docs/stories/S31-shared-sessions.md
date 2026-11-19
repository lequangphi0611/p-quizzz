# S31 — Trang chia sẻ các phiên đã thi

**Phụ thuộc:** S16, S17, S18, S20 · **Trạng thái:** ⬜ chưa làm

## Bối cảnh
Người vắng buổi hoặc mới vào dự án muốn ôn đúng phần lớp đã làm; mentor không muốn gửi tay file đề (file có cả đề còn dùng) hay chụp màn hình. Business: [PRODUCT.md §7.33](../PRODUCT.md), §4.6, §7.16, §7.24. Thiết kế: [S31-shared-sessions-ui-prompt.md](../design/S31-shared-sessions-ui-prompt.md).

## Quyết định của PO (2026-11-19)
Qua báo cáo làm rõ yêu cầu: **một link chung** cho trang danh sách các phiên mentor chia sẻ; chi tiết chỉ có đề + đáp án + lời giải + tỉ lệ chọn của lớp, **không tên, không điểm, không bài làm, không bảng xếp hạng**. Chỉ chia sẻ được phiên `closed`/`finalized`. Thu hồi bằng ngừng chia sẻ phiên hoặc "Đổi link". Người đã thi được báo ở trang "Xem lại bài". Không làm: nhãn công khai, link riêng từng phiên, giới hạn theo email.

## Phạm vi
Contract: `architecture.md` §2 (`sessions.shared_at`, `app_meta.share_token`), §5 (mentor: `share`, `share-link`; công khai: `/api/shared/*`; review: `shared`), §5 "Quy tắc không lộ đáp án" (mục chia sẻ), §8 (route `/shared/*`), §11.7.

- **Server**
  - Migration: cột `sessions.shared_at` (timestamp, null).
  - Domain thuần `domain/sharing/`: điều kiện được bật chia sẻ (`closed`/`finalized`), dựng chi tiết công khai từ đề + thống kê (ngưỡng `MIN_SUBMISSIONS_FOR_DISTRIBUTION = 3`).
  - Use cases `application/use-cases/sharing/`: `SetSessionShared`, `GetShareLink` (sinh token lần đầu), `RotateShareLink`, `ListSharedSessions`, `GetSharedSession`. Port `ShareTokenStore` (app_meta) và đọc thống kê lựa chọn dùng lại query của chế độ thảo luận (§11.5) nếu được.
  - Route `interface/http/admin-share-routes.ts` và `shared-routes.ts`; so token bằng hằng-thời-gian.
  - `leak-guard.ts`: cho phép `isCorrect`/`explanation` ở hai route `/api/shared/*`; ở các route đó chặn thêm mọi key định danh/bài làm (xem §5).
  - Bổ sung `shared` vào review của member, `sharedAt` vào summary/chi tiết phiên của mentor, `share.examUnfinishedSessions` vào chi tiết.
- **Web**
  - Feature mới `features/shared-sessions/{domain,application,infrastructure,ui}`: trang danh sách, trang chi tiết, các trạng thái (rỗng, link không hiệu lực, phiên ngừng chia sẻ, tải, lỗi). Dùng `MemberLayout`, `ReviewQuestions` hoặc component phân bố theo bản thiết kế.
  - `session-admin`: công tắc chia sẻ + hộp xác nhận (cảnh báo mạnh khi `examUnfinishedSessions > 0`) ở trang xem lại phiên; khu "Link chia sẻ" (sao chép, đổi link); dấu "đang chia sẻ" trong danh sách phiên.
  - `member-review`: dòng thông báo khi `shared = true`.
  - Router: `/shared/:token`, `/shared/:token/sessions/:sessionId`.
- **UI chờ bản thiết kế**; phần server + domain làm trước được.

## Acceptance criteria
- [ ] Mentor bật được chia sẻ chỉ khi phiên `closed`/`finalized`; phiên khác → 409. Tắt được bất cứ lúc nào, có hiệu lực ngay.
- [ ] Hộp xác nhận khi bật có cảnh báo lộ đáp án; đề còn phiên `draft`/`lobby`/`running` → cảnh báo mạnh kèm số phiên.
- [ ] Mentor sao chép được link; "Đổi link" (có xác nhận) làm link cũ trả lỗi trung tính ngay.
- [ ] Link đúng: danh sách các phiên đang chia sẻ, mới nhất trước (theo `started_at`), mỗi dòng chỉ có tên đề, ngày giờ thi, số câu. Không có phiên → trạng thái rỗng.
- [ ] Chi tiết theo thứ tự đề gốc: đề, đáp án đúng, giải thích, đáp án mẫu tự luận, tỉ lệ chọn từng phương án + bỏ trống; < 3 bài nộp → không có tỉ lệ (API trả `distribution: null`).
- [ ] Response `/api/shared/*` **không bao giờ** chứa tên phiên, tên nhóm, tên/email người thi, điểm, bài làm, lý do, nhận xét, gợi ý AI (test quét key).
- [ ] Link sai/đã đổi → cùng một 404 trung tính; link đúng nhưng phiên không (còn) chia sẻ → 404 `session_not_shared`; quay lại danh sách hoạt động.
- [ ] Trang "Xem lại bài" của người đã thi hiện dòng thông báo khi phiên đang được chia sẻ.
- [ ] Màn chiếu, bảng xếp hạng, mã phòng (§7.16, §7.29b) không đổi.

## Test
- Domain: `domain/sharing/*.test.ts` (điều kiện bật, ngưỡng tỉ lệ, dựng DTO không có key cấm).
- Use case: `application/use-cases/sharing/*.test.ts` với fakes trong `application/testing/`.
- Tích hợp HTTP: `test/integration/sharing.test.ts` (409 khi chưa đóng, đổi link, token sai, phiên ngừng chia sẻ, quét key cấm, leak-guard).
- Web: domain + controller của `features/shared-sessions`.
- E2E: `e2e/shared-sessions.spec.ts` (mentor bật → mở link → danh sách → chi tiết → quay lại; đổi link → link cũ hỏng); ảnh vào `docs/design/S31-assets/`.

## Giới hạn đã biết / chưa làm
- Link chuyền tay được; ai có link thấy cả phiên chia sẻ về sau; không thu hồi theo từng người (§7.33).
- Không có giới hạn số lần thử token (token 32 byte không đoán được).
- Chưa làm: bảng điểm trên trang chia sẻ, nhãn công khai, link riêng từng phiên, giới hạn theo email nhóm.
