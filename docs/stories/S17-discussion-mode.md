# S17 — Chế độ thảo luận sau phiên

**Phụ thuộc:** S13, S15, S16 · **Thiết kế UI:** [prompt cho designer](../design/S17-discussion-ui-prompt.md) · **Trạng thái:** ✅ xong (2026-11-15)

## Bối cảnh
Sau khi đóng phiên, mentor muốn **chiếu từng câu** để cả lớp cùng mổ xẻ: đề, cả lớp đã chọn gì, đáp án đúng + lời giải, và các bài tự luận (ẩn danh). Câu tự luận chưa chấm thì cả lớp đi **từng bài**, bàn, rồi mentor nhập điểm ngay tại đó và cuối buổi chốt kết quả. Business: [PRODUCT.md §4.6, §7.17](../PRODUCT.md). Contract: [architecture.md §5 (`/sessions/:id/discussion`), §8](../architecture.md).

Đã có, **dùng lại, không viết lại**: chấm từng bài `PUT /api/admin/answers/:id/grade` và điều kiện chốt (S15), `QuestionPreview`/`AnswerOption`/`<Markdown>` (S05), bảng xếp hạng (S13), `pickCountedAttempt` (S11).

## Phạm vi

### API — `GET /api/admin/sessions/:id/discussion` (mentor, máy mentor)
- Chỉ khi session `closed` hoặc `finalized`; trạng thái khác → 409 "Chỉ thảo luận được sau khi đóng phiên". Phiên không tồn tại → 404.
- Dữ liệu tính trên **lượt được tính** (lượt duy nhất đã nộp) của participant `active`. Người bị kick, người chờ duyệt, người không nộp: không tính.
- Response (type đặt ở `src/shared/api/discussion.ts`):
  ```ts
  interface DiscussionView {
    sessionId: number; examTitle: string; status: 'closed' | 'finalized';
    submitted: number;            // số bài được tính
    graded: number; total: number; // tiến độ chấm tự luận toàn phiên (như GradingView)
    questions: DiscussionQuestion[]; // theo position
  }
  interface DiscussionQuestion {
    id: number; position: number; type: 'single' | 'multi' | 'essay';
    prompt: string; body: string; points: number; explanation: string | null;
    // Trắc nghiệm
    options: { id: number; text: string; isCorrect: boolean; count: number }[]; // theo position; count = số người chọn phương án này
    correctCount: number;  // số người đạt đủ điểm câu này
    blankCount: number;    // số người không chọn gì / để trống
    // Tự luận
    answers: { answerId: number; label: string; textAnswer: string | null; manualScore: number | null; feedback: string | null }[];
  }
  ```
- **Không** có `displayName`, `participantId`, `attemptId` hay bất cứ gì nối được bài với người. `label` là "Bài #1…#n" theo thứ tự **trộn cố định**: cùng phiên, cùng câu → cùng thứ tự mỗi lần tải lại; khác câu → khác thứ tự; **không** theo id/thứ tự vào phòng. Gợi ý: sắp theo `hash(sessionId, questionId, answerId)`.
- Bài tự luận bỏ trống vẫn có trong `answers` (`textAnswer` null/rỗng) để chấm được (thường 0).

### UI — `/admin/sessions/:id/discuss`
- Lối vào: nút **"Thảo luận"** ở dòng phiên đã đóng/đã chốt trong danh sách phiên, ở trang điều khiển phiên và trang "Xem lại phiên".
- Mỗi lần **một câu**, chữ đủ to để chiếu; nút **Toàn màn hình** (Fullscreen API). Phím: `←`/`→` câu trước/sau, `Space` hiện/ẩn đáp án, `Esc` thoát toàn màn hình. Câu đang xem nằm trong URL (`?q=3`) để tải lại vẫn đúng chỗ.
- Thanh chọn câu `1…n`; câu tự luận hiển thị tiến độ chấm `x/y`; tổng tiến độ chấm của phiên luôn thấy.
- **Trắc nghiệm**: đề + body; mỗi phương án có thanh tỉ lệ + số người chọn; dòng tóm tắt "x/y làm đúng (z%) · k bỏ trống". **Đáp án mặc định ẩn**: thanh trung tính; bấm **"Hiện đáp án"** → tô đúng/sai + hiện lời giải; mỗi câu mở ra ở trạng thái ẩn.
- **Tự luận**: đề + body; đáp án mẫu & rubric cũng ẩn/hiện bằng cùng nút. Danh sách bài ẩn danh; mỗi bài: nội dung (monospace), ô điểm (0 → điểm câu, bước 0,5) + nhận xét, trạng thái Đã chấm/Chưa chấm. **Chế độ từng bài**: bấm một bài → phóng to riêng bài đó, có Bài trước/Bài sau (phím `J`/`K`) để cả lớp đi từng bài; ô chấm ở ngay đó. Bài bỏ trống gom thành một dòng "N bài bỏ trống" + nút "Chấm 0 cho N bài".
- Lưu điểm khi rời ô / Enter (như S15). Lỗi (vd. ngoài khoảng điểm) hiện tại chỗ.
- **Chốt kết quả**: nút hiện khi phiên `closed`; bật khi đã chấm đủ; xác nhận → `POST /sessions/:id/finalize` → vẫn ở lại màn thảo luận, ô chấm khoá (chỉ xem). Phiên `finalized` mở ra là chỉ xem.
- **Không có tên ở bất kỳ đâu, không có nút hiện tên.** Không hiện bảng xếp hạng có tên trong màn này (đã có ở màn chiếu/trang xem lại).

## Quy tắc
- Chỉ `closed`/`finalized`. Chỉ mentor (đã có `requireMentor` + `requireLocal`).
- Thống kê chỉ từ lượt được tính của participant `active`.
- Chấm điểm và chốt kết quả theo đúng quy tắc S15 (0 ≤ điểm ≤ điểm câu, bội số 0,5; chốt khi không còn bài thiếu; sau chốt → 409).
- Response không chứa thông tin nhận diện người làm (test quét key).

## Ngoài phạm vi
- Điện thoại member tự nhảy theo câu đang chiếu, highlight "bài của bạn" (bản 2, sau thiết kế live mode).
- Học viên bỏ phiếu điểm. Hiện tên. Xuất file kết quả.

## Acceptance criteria
- [x] Mở thảo luận khi phiên `running` → 409; `closed`/`finalized` → được.
- [x] Số người chọn từng phương án, số làm đúng, số bỏ trống khớp dữ liệu (kể cả câu nhiều đáp án); người bị kick/chờ duyệt không được tính.
- [x] Response và màn hình không chứa tên hay id người làm; thứ tự bài ẩn danh cố định khi tải lại và khác thứ tự vào phòng.
- [x] Đáp án mặc định ẩn ở mọi câu; `Space`/nút hiện ra; `←`/`→` chuyển câu; tải lại giữ đúng câu.
- [x] Chấm được ngay trong màn thảo luận, kể cả "chấm 0" hàng loạt; tiến độ cập nhật; chốt được khi đủ; sau chốt chỉ xem.
- [x] Đọc rõ khi chiếu (thử ở 1920×1080 và 1366×768), không tràn ngang.

## Test bắt buộc
- API: 401/403 (cookie, máy khác), 404, 409 khi chưa đóng; đếm phương án/đúng/bỏ trống cho single, multi; loại kick/pending/không nộp; quét key không có `displayName`/`participantId`/`attemptId`; thứ tự bài ổn định qua 2 lần gọi và không trùng thứ tự theo `participantId` (với ≥ 5 bài); bài bỏ trống có mặt.
- UI: không bắt buộc test tự động; ghi lại luồng đã thao tác tay (chiếu, phím tắt, chấm từng bài, chấm 0 hàng loạt, chốt).

## Ghi chú khi làm
- **Thiết kế**: theo bộ p-quizzz Design System bản 2 (component mới `OptionTally`, `EssayCard`, `ScoreField` ở `src/web/components/screen/`; `Button`/`ConfirmDialog`/`TextField`/`ErrorMessage`/`QuestionNav`/`SaveIndicator`/`StatusBadge`/`ScreenLayout` thêm biến thể màn chiếu; token `--screen-*` mới).
- **Lệch so với bản vẽ**: bản vẽ tách "Rubric" và "Bài mẫu" thành 2 tab, nhưng format đề chỉ có **một** khối giải thích cho câu tự luận (đáp án mẫu + rubric viết chung) → hiển thị một khung Markdown, không có tab.
- "Nhầm phổ biến": phương án sai được chọn nhiều nhất, chỉ khi ≥ 20% số bài và không hoà (`commonMistakeId`).
- Tiến độ chấm (thanh câu, danh sách bài, đầu trang) **tính cả bài bỏ trống**, vì bài bỏ trống cũng phải có điểm mới chốt được.
- `Enter` ở ô điểm: lưu rồi nhảy sang bài chưa chấm tiếp theo. `Esc` lần 1 rời ô nhập, lần 2 về danh sách bài (khi không ở toàn màn hình; ở toàn màn hình trình duyệt dùng `Esc` để thoát).
- Response chấm điểm (`PUT /answers/:id/grade`, dùng lại từ S15) vẫn có `displayName`; màn thảo luận **không hiển thị** trường này. Chấp nhận vì endpoint chỉ mở trên máy mentor.

## Đã thao tác tay (Playwright, 8 học viên, 1920×1080 và 1366×768)
Mở từ danh sách phiên → đáp án ẩn mặc định, không có tên trên màn → `Space` hiện đáp án (đúng: xanh + "Đáp án đúng"; "Nhầm phổ biến") → `→` sang câu nhiều đáp án, lại ẩn, URL `?q=2` → tải lại giữ đúng câu → câu tự luận: 6 bài ẩn danh + "2 bài bỏ trống" → `J` mở bài chưa chấm → điểm 7 báo "Điểm phải từ 0 đến 5" → 4,5 + nhận xét → "Đã lưu" → `Enter` sang bài kế → chấm nốt bằng nút điểm nhanh → hộp chốt khoá "Còn 2 bài chưa chấm" → "Chấm 0 cho 2 bài" → chốt → "Đã chốt — chỉ xem", ô điểm khoá → API không chứa tên nào; gọi từ máy khác → 403 → "Thoát" về trang phiên.
