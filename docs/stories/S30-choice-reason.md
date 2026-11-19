# S30 — Ô lý do cho câu trắc nghiệm

**Phụ thuộc:** S04, S11, S12, S16, S17, S18, S24, S25 · **Trạng thái:** chưa làm

## Bối cảnh
Mentor muốn biết member nghĩ gì khi chọn đáp án: bắt người chọn đúng nhờ đoán mò, và chữa đúng chỗ khi nhiều người dồn vào một phương án sai. Business: [PRODUCT.md §7.32](../PRODUCT.md), §4.5, §7.17, §7.21, §7.26.

## Quyết định của PO (2026-11-19)
Phương án B trong báo cáo làm rõ yêu cầu: lý do **không tính điểm**. Câu nào có ô lý do do **skill soạn đề đề xuất**, mentor duyệt trong file đề (`{reason}`). Câu đã đánh dấu thì lý do **bắt buộc khi đã chọn đáp án**. Nhận xét của mentor cho từng lý do: để sau. Thảo luận: hiện tất cả lý do, mặc định ẩn (PO chưa chọn "lọc vài lý do", để sau).

## Phạm vi

### Định dạng đề (đổi cùng lúc: `docs/exam-format.md`, parser, `parse.test.ts`)
- Thêm key `reason` (cờ, không có giá trị) vào thuộc tính tiêu đề: `{reason}`, `{reason, points=2}`.
- `reason` trên câu `{essay}` → **lỗi** (tiếng Việt, có số dòng). Lặp key → lỗi như các key khác.
- `ParsedQuestion` thêm `requireReason: boolean`. Ví dụ trong `exams/examples/` có ít nhất một câu `{reason}`.
- Preview import (S05) hiện nhãn "Hỏi lý do" ở câu được đánh dấu.

### Skill `exam-authoring`
- Thêm `{reason}` vào bảng cú pháp và tiêu chí chọn câu theo §7.32a: nên dùng cho câu có phương án bẫy theo hiểu nhầm phổ biến, câu chọn cách làm theo tình huống, câu dễ đoán mò; không dùng cho câu nhớ định nghĩa/cú pháp và câu tự luận; mặc định ~20–30% số câu trắc nghiệm; mentor yêu cầu khác thì theo mentor. Báo cho mentor câu nào đã đánh dấu khi trình đề.

### Server (cần sửa `docs/architecture.md` trong cùng commit)
- Schema + migration: `questions.require_reason` (bool, mặc định false); `answers.reason_text?` (text). Đề cũ không đổi hành vi.
- `MemberQuestion` thêm `requireReason`. `GET /api/me/attempts/:id` trả kèm `reasonText` đã lưu.
- `PUT /api/me/attempts/:id/answers/:questionId`: nhận thêm `reasonText?` cùng `selectedOptionIds` (chỉ với câu `requireReason`; câu khác → 400). Tối đa 200 ký tự sau khi trim → 400. Lượt đã nộp: **không** lưu được `reasonText` kể cả khi yêu cầu sửa đang `approved` (§7.32d).
- `POST /api/me/attempts/:id/submit` (member tự nộp): còn câu `requireReason` có lựa chọn mà `reasonText` trống (sau trim) → 409 `{ code: 'reason_missing', questionIds }`. **Tự nộp khi hết giờ / đóng phiên** đi đường riêng, không kiểm điều kiện này.
- Chấm điểm, điểm tạm tính, `canFinalize`, tiến độ "đã trả lời" (§7.26b): **không đổi**.
- `GET /api/me/attempts/:id/review`: trả `reasonText` của chính member.
- Admin: trang xem lại phiên (bài làm chi tiết từng người) trả `reasonText`. `GET /api/admin/sessions/:id/discussion` trả thêm theo câu `reasons: { optionIds: number[], text }[]`: **không** có participant id/tên, thứ tự trộn cố định trong phiên (cùng cách trộn bài tự luận của S17).
- `leak-guard`: chặn key `reasons` ở mọi response ngoài `/api/admin/*`. Màn chiếu công khai và bảng xếp hạng không có lý do.

### Web
- `features/member-exam`: ô lý do dưới danh sách đáp án ở câu `requireReason`, nhãn "Lý do (bắt buộc, không tính điểm)", đếm ký tự /200, autosave như tự luận. Danh sách câu báo riêng "thiếu lý do" (khác "chưa trả lời"). Bấm nộp còn thiếu → hộp thoại liệt kê các câu, bấm vào nhảy tới câu. Dùng tốt trên laptop và điện thoại (S18).
- Trang "Xem lại bài": hiện lý do của mình dưới lựa chọn.
- Trang xem lại phiên của mentor: hiện lý do cạnh lựa chọn từng người.
- `features/discussion`: khối "Lý do của lớp" mặc định ẩn, nút + phím tắt riêng (không dùng chung nút hiện đáp án), nhóm theo phương án (nhóm hiện theo nhãn phương án như phân bố lựa chọn đang hiện), không tên. Đổi câu thì khối ẩn lại. **Cần designer** cho khối này: prompt ở [S30-reason-ui-prompt.md](../design/S30-reason-ui-prompt.md); phím tắt đề xuất `R`.

## Acceptance criteria
- [ ] `{reason}` trên câu single/multi import được; trên câu tự luận báo lỗi có số dòng; đề không có `{reason}` chạy như cũ.
- [ ] Member thấy ô lý do chỉ ở câu được đánh dấu; F5 giữ nguyên lý do đã gõ.
- [ ] Bấm nộp khi còn câu đã chọn mà thiếu lý do → không nộp được, app chỉ ra các câu đó; bỏ trống cả câu thì vẫn nộp được.
- [ ] Hết giờ hoặc mentor đóng phiên → bài vẫn tự nộp dù thiếu lý do.
- [ ] Lý do không đổi điểm, xếp hạng, điểm tạm tính, việc tự chốt kết quả hay số "đã trả lời" của mentor.
- [ ] Lượt đã nộp (kể cả đang được sửa tự luận) không sửa được lý do.
- [ ] Member chỉ thấy lý do của mình, và chỉ từ `CLOSED` ở trang xem lại; không API member/công khai nào trả lý do người khác.
- [ ] Chế độ thảo luận: khối lý do mặc định ẩn, bấm mới hiện, nhóm theo phương án, không tên, thứ tự cố định khi F5.
- [ ] Mentor thấy lý do kèm tên ở trang xem lại phiên.

## Test
- `parse.test.ts`: `{reason}`, `{reason, points=N}`, `{essay, reason}` lỗi, lặp key.
- Use case / integration: lưu + giới hạn 200 ký tự; `reason_missing` khi tự nộp; tự nộp khi đóng phiên và khi hết giờ không bị chặn; khoá sau khi nộp kể cả khi sửa tự luận được duyệt; điểm không đổi; review trả lý do của mình; discussion không có participant id; quét `reasons` trên mọi response `/api/me/*` và công khai.
- E2E `e2e/s30-choice-reason.spec.ts`: làm bài có câu lý do (laptop + điện thoại), chặn nộp, xem lại, thảo luận hiện/ẩn; ảnh vào `docs/design/S30-assets/`.

## Giới hạn đã biết / chưa làm
- Member có thể gõ đại cho đủ; văn phong có thể lộ người viết trong nhóm nhỏ (§7.32).
- Chưa làm: nhận xét của mentor cho từng lý do, chọn lọc vài lý do để chiếu, chấm điểm lý do.
