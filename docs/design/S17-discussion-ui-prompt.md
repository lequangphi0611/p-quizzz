# Prompt thiết kế UI — Chế độ thảo luận (S17)

> Dán nguyên phần dưới đường kẻ vào công cụ thiết kế có **p-quizzz Design System**. Spec đầy đủ: [S17-discussion-mode.md](../stories/S17-discussion-mode.md).

---

Thiết kế màn **"Thảo luận"** cho p-quizzz, dùng đúng **p-quizzz Design System** (token màu, typography, spacing, radius, motion, icon Lucide, và các component: `Button`, `Card`, `ConfirmDialog`, `ErrorMessage`, `Spinner`, `StatusBadge`, `TextField`, `Icon`, `Markdown`, `AnswerOption`, `QuestionNav`, `QuestionPreview`, `SaveIndicator`, `ScreenLayout`). Toàn bộ chữ trên UI bằng **tiếng Việt**.

## Bối cảnh
p-quizzz là app luyện thi chạy trên máy một mentor; học viên vào bằng điện thoại qua mạng LAN. Sau khi **đóng phiên thi**, mentor mở màn này và **chiếu lên máy chiếu** để cả lớp cùng mổ xẻ từng câu: cả lớp đã chọn gì, đáp án đúng, lời giải, và các bài tự luận. Câu tự luận chưa chấm thì cả lớp đi **từng bài**, bàn với nhau, rồi **mentor nhập điểm** ngay trên màn (học viên không thao tác). Cuối buổi mentor **chốt kết quả**.

Người thao tác: mentor, dùng chuột/bàn phím trên laptop, màn hình laptop chính là màn được chiếu.
Người xem: 10–30 học viên ngồi cách màn chiếu 3–8 m.

## Ràng buộc bắt buộc
- **Không có tên học viên ở bất kỳ đâu**, không có nút "hiện tên". Bài tự luận chỉ có nhãn **"Bài #1, Bài #2…"**.
- **Đọc được từ xa**: thiết kế cho khung **1920×1080** (chữ nội dung ≥ 28 px, đề câu hỏi ≥ 40 px, số liệu lớn ≥ 48 px), và kiểm tra lại ở **1366×768** (laptop). Không tràn ngang.
- Dùng **chủ đề tối của màn chiếu** trong design system (`--screen-bg`, `--screen-panel`, `--screen-line`, `--screen-text`, `--screen-meta`), tương phản cao; màu không phải tín hiệu duy nhất (đúng/sai phải có icon + chữ).
- Font và icon đã có sẵn trong design system (app chạy offline, không dùng tài nguyên ngoài).
- Đáp án đúng + lời giải **mặc định ẩn** ở mọi câu; mentor bấm "Hiện đáp án" (phím `Space`) mới hiện.

## Khung màn hình
- **Thanh trên** (gọn, không phải thanh điều hướng admin): wordmark p-quizzz · tên đề · `StatusBadge` (Đã đóng / Đã chốt) · tiến độ chấm toàn phiên "Đã chấm 7/12" · nút **Toàn màn hình** · nút **Chốt kết quả** · nút thoát (về trang phiên).
- **Thanh chọn câu**: các ô `1…n` (dựa trên `QuestionNav`); ô câu tự luận có thêm tiến độ chấm nhỏ "2/5"; ô đang xem nổi bật. Hai nút ‹ › ở hai đầu.
- **Vùng nội dung**: một câu tại một thời điểm. Gợi ý phím tắt nhỏ ở góc dưới: `← →` câu · `Space` đáp án · `J K` bài · `Esc` thoát toàn màn hình.

## Các màn / trạng thái cần thiết kế
1. **Câu một đáp án — đáp án đang ẩn.** Đề (Markdown, có thể có code block) + body. Mỗi phương án: chữ phương án + **thanh tỉ lệ ngang** + "12 người · 40%". Thanh màu trung tính, chưa lộ đúng/sai. Dòng tóm tắt dưới: "30 bài · 3 bỏ trống". Nút lớn **"Hiện đáp án"**.
2. **Cùng câu đó — đã hiện đáp án.** Phương án đúng: tô xanh + icon ✓ + "Đáp án đúng"; các phương án sai giữ trung tính (không tô đỏ cả lớp). Tóm tắt thành "**18/30 làm đúng (60%)** · 3 bỏ trống". Khối **Giải thích** (Markdown) bên dưới. Nút đổi thành "Ẩn đáp án".
3. **Câu nhiều đáp án — đã hiện đáp án.** Như (2) nhưng nhiều phương án đúng; ghi chú "Phải chọn đúng **đủ** các đáp án mới có điểm"; "làm đúng" = chọn đúng trọn bộ.
4. **Câu tự luận — danh sách bài (đáp án đang ẩn).** Đề + body; khối "Đáp án mẫu & rubric" ẩn sau nút "Hiện đáp án". Lưới thẻ bài ẩn danh: "Bài #3", trích đoạn nội dung (monospace, vài dòng), trạng thái **Chưa chấm** / **Đã chấm 3,5/5**. Một dòng gom **"4 bài bỏ trống"** + nút "Chấm 0 cho 4 bài". Tiến độ câu "Đã chấm 2/9".
5. **Câu tự luận — chế độ từng bài.** Một bài phóng to chiếm phần lớn màn hình, nội dung đầy đủ (monospace, cuộn nếu dài). Bên cạnh/bên dưới: rubric (nếu đã hiện), **ô điểm lớn** "__ / 5" (bước 0,5) + ô **nhận xét** (tuỳ chọn) + trạng thái lưu (`SaveIndicator`). Điều hướng **‹ Bài trước · Bài #3 / 9 · Bài sau ›** (phím `J`/`K`). Nút quay về danh sách.
6. **Lỗi khi chấm**: điểm ngoài khoảng → thông báo tại chỗ "Điểm phải từ 0 đến 5" (`ErrorMessage`).
7. **Hộp xác nhận chốt** (`ConfirmDialog`): "Chốt kết quả? Điểm sẽ thành chính thức, bảng xếp hạng bỏ nhãn "Tạm tính" và không sửa điểm được nữa." Nút "Chốt kết quả" bị khoá (kèm lý do "Còn 5 bài chưa chấm") khi chưa chấm đủ.
8. **Đã chốt — chỉ xem**: ô điểm khoá, nhãn "Đã chốt — chỉ xem", vẫn chuyển câu / hiện đáp án bình thường.
9. **Trạng thái trống / tải / lỗi**: không ai nộp bài ("Phiên này không có bài nào để thảo luận"); đang tải (`Spinner`); lỗi tải có nút thử lại.

## Dữ liệu mẫu (giả lập, 30 bài được tính)
Đề: **Ôn tập Git cơ bản** — tổng 9 điểm.
- **Câu 1** (một đáp án, 1 điểm) — "Lệnh nào vừa tạo branch mới vừa chuyển sang branch đó?"
  `git branch feature` 8 · **`git checkout -b feature` 18 ✓** · `git merge feature` 1 · `git fetch feature` 0 · bỏ trống 3.
  Giải thích: "`git checkout -b` (hoặc `git switch -c`) tạo branch rồi chuyển sang ngay. `git branch` chỉ tạo, không chuyển."
- **Câu 2** (nhiều đáp án, 2 điểm) — "Những lệnh nào tạo ra commit mới thay vì giữ nguyên commit cũ?"
  **`git commit --amend` 21 ✓** · **`git rebase main` 14 ✓** · `git log` 4 · `git status` 2 · chọn đúng trọn bộ: 11 · bỏ trống 2.
- **Câu 3** (một đáp án, 1 điểm, có code block)
  ```bash
  echo "hello" > a.txt
  git add a.txt
  echo "world" >> a.txt
  ```
  "Sau khi chạy đoạn lệnh trên, `git status` hiển thị file `a.txt` ở trạng thái nào?" — Chỉ "Changes to be committed" 9 · Chỉ "Changes not staged" 5 · **Cả hai mục 13 ✓** · Untracked 1 · bỏ trống 2.
- **Câu 4** (tự luận, 5 điểm) — "Khi nào nên dùng `merge`, khi nào nên dùng `rebase`? Nêu một rủi ro của `rebase`."
  Rubric: "2đ đúng bản chất merge · 2đ đúng bản chất rebase · 1đ nêu rủi ro: rebase branch đã push làm người khác lệch lịch sử."
  Bài mẫu: "Merge giữ nguyên lịch sử, tạo merge commit — dùng cho branch chung. Rebase làm lịch sử thẳng, hợp để cập nhật branch cá nhân. Rủi ro: rebase branch đã push." (Đã chấm 4,5/5) · "merge gộp nhánh, rebase thì viết lại" (Chưa chấm) · một bài dài ~15 dòng để thử cuộn · 4 bài bỏ trống.

## Cần giao
- Frame 1920×1080 cho các trạng thái 1–8 (trạng thái 9 có thể gom một frame), và bản 1366×768 cho trạng thái 1 và 5.
- Ghi chú tương tác: phím tắt, hiệu ứng hiện đáp án (dùng motion token, ngắn, có biến thể giảm chuyển động), trạng thái hover/focus của thẻ bài và ô điểm (focus phải rõ trên nền tối).
- Nếu cần component mới (vd. "thanh tỉ lệ phương án", "thẻ bài ẩn danh"), mô tả props và biến thể để bổ sung vào design system.

## Câu hỏi mở để designer đề xuất
- Thanh tỉ lệ đặt cạnh phương án hay nằm dưới thành biểu đồ riêng?
- Ở trạng thái đã hiện đáp án, phương án sai được chọn nhiều có nên được nhấn (vd. "Nhầm phổ biến") để gợi chủ đề thảo luận?
