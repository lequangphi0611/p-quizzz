# Prompt thiết kế UI — Thảo luận: đọc đề trước, ẩn bài làm của lớp (S25)

> Dán nguyên phần dưới đường kẻ vào công cụ thiết kế có **p-quizzz Design System** (đã có các component màn thảo luận của S17). Spec đầy đủ: [S25-discussion-hide-work.md](../stories/S25-discussion-hide-work.md). Bản thiết kế gốc của màn: [S17-discussion-ui-prompt.md](S17-discussion-ui-prompt.md).

---

Thiết kế **bổ sung** cho màn **"Thảo luận"** đã có của p-quizzz. Dùng đúng **p-quizzz Design System**: token màu (chủ đề tối màn chiếu `--screen-*`), typography, spacing, radius, motion, icon Lucide, và các component đã có, gồm `Button` (tone screen), `OptionTally`, `EssayCard`, `ScoreField`, `QuestionNav`, `Markdown`, `ScreenLayout`, khung "đang ẩn" (`hiddenPanel`) và nút "Hiện/Ẩn đáp án". Toàn bộ chữ trên UI bằng **tiếng Việt**. Giữ nguyên bố cục và phong cách hiện tại. Đây là thêm trạng thái, không vẽ lại màn.

## Bối cảnh
Sau khi đóng phiên thi, mentor chiếu màn "Thảo luận" lên máy chiếu để cả lớp mổ xẻ từng câu. Hiện tại đáp án đúng đã ẩn sẵn, nhưng **số người chọn từng phương án** và **các bài tự luận** hiện ngay khi mở câu. Thấy "18/30 chọn B" là cả lớp ngả theo B trước khi kịp tự nghĩ.

Thay đổi: mỗi câu mở ra **chỉ có đề**. Có **hai phần ẩn độc lập**, mentor mở theo thứ tự tuỳ câu:
- **Bài làm của lớp**: số người chọn từng phương án, "Nhầm phổ biến", "x/y làm đúng", các bài tự luận ẩn danh. Nút **"Hiện bài làm"**, phím `B`.
- **Đáp án**: đáp án đúng + lời giải (với tự luận là đáp án mẫu & rubric). Nút **"Hiện đáp án"**, phím `Space` (như cũ).

Có câu mentor mở bài làm trước để hỏi "sao nhiều bạn chọn C?" rồi mới mở đáp án. Có câu thì mở đáp án trước, sau mới xem lớp làm ra sao.

Người thao tác: mentor, dùng chuột/bàn phím trên laptop, màn laptop chính là màn được chiếu.
Người xem: 10–30 học viên ngồi cách màn chiếu 3–8 m.

## Ràng buộc bắt buộc
- Khung **1920×1080**, kiểm tra lại ở **1366×768**. Chữ nội dung ≥ 28 px, đề ≥ 40 px. Không tràn ngang.
- Cả lớp phải **nhìn là biết ngay** đang ở trạng thái nào: chưa mở gì, mới mở bài làm, mới mở đáp án, hay đã mở cả hai. Không dựa vào màu làm tín hiệu duy nhất (phải có icon + chữ).
- Khi bài làm đang ẩn, **không được lộ bất kỳ con số nào về cách lớp chọn**: không thanh tỉ lệ, không độ dài thanh, không "Nhầm phổ biến", không "x/y làm đúng". Chỉ được hiện tổng số bài và số bỏ trống.
- Không có tên học viên ở bất kỳ đâu (như S17).
- Hai nút phải phân biệt rõ, không bấm nhầm (bấm nhầm là lộ đáp án trước cả lớp). Đề dài 30 câu, mỗi câu bấm 1–2 lần, nên nút phải dễ trúng và có gợi ý phím.
- App chạy offline: chỉ dùng font, icon có sẵn trong design system.

## Các trạng thái cần thiết kế

### Trắc nghiệm (dữ liệu: Câu 1 bên dưới)
1. **Chưa mở gì (trạng thái mặc định khi vào câu).** Đề + body + **các phương án A/B/C/D dạng trơn** để đọc đề (không thanh, không số). Khung "Đáp án và giải thích đang ẩn". Dòng dưới: "30 bài · 3 bỏ trống". Hai nút **"Hiện bài làm" (B)** và **"Hiện đáp án" (Space)**.
2. **Mở bài làm, đáp án còn ẩn.** Như màn S17 hiện tại: thanh tỉ lệ trung tính + "18 người · 60%". Nút thứ nhất đổi thành "Ẩn bài làm".
3. **Mở đáp án, bài làm còn ẩn.** Phương án đúng tô xanh + icon ✓ + "Đáp án đúng"; khối **Giải thích**. **Không** có số liệu nào của lớp.
4. **Mở cả hai.** Như màn S17 khi đã hiện đáp án: thanh tỉ lệ, đúng/sai, "Nhầm phổ biến", "**18/30 làm đúng (60%)** · 3 bỏ trống", Giải thích.
5. **Câu nhiều đáp án, trạng thái 1** (dữ liệu Câu 2): kiểm tra phương án trơn vẫn cho biết đây là câu chọn nhiều (vd. ô vuông thay vì tròn, ghi chú "Chọn nhiều đáp án").

### Tự luận (dữ liệu: Câu 4 bên dưới)
6. **Chưa mở gì.** Đề + body + khung "Đáp án mẫu & rubric đang ẩn". Thay lưới thẻ bài bằng một khung **"Bài làm của lớp đang ẩn"** + "9 bài · 4 bỏ trống" + nút "Hiện bài làm". Tiến độ chấm "Đã chấm 2/9" vẫn hiện (không lộ nội dung).
7. **Mở bài làm.** Về đúng lưới thẻ bài ẩn danh của S17 (không cần vẽ lại, chỉ cần thấy nút "Ẩn bài làm" nằm ở đâu).
8. **Mở đáp án, bài làm còn ẩn.** Rubric hiện, khung bài làm vẫn ẩn.

### Chung
9. **Gợi ý phím** ở góc dưới thêm `B` bài làm: `← →` câu · `B` bài làm · `Space` đáp án · `J K` bài · `Esc` thoát toàn màn hình. Khi bài làm ẩn, `J K` không có tác dụng: làm mờ gợi ý hay bỏ đi?
10. **Hiệu ứng mở bài làm**: dùng motion token, ngắn, có biến thể giảm chuyển động. Gợi ý: thanh tỉ lệ chạy từ 0 lên, để tạo khoảnh khắc "công bố" cho lớp.

## Dữ liệu mẫu (giả lập, 30 bài được tính)
Đề: **Ôn tập Git cơ bản**.
- **Câu 1** (một đáp án, 1 điểm): "Lệnh nào vừa tạo branch mới vừa chuyển sang branch đó?"
  `git branch feature` 8 · **`git checkout -b feature` 18 ✓** · `git merge feature` 1 · `git fetch feature` 0 · bỏ trống 3.
  Giải thích: "`git checkout -b` (hoặc `git switch -c`) tạo branch rồi chuyển sang ngay. `git branch` chỉ tạo, không chuyển."
- **Câu 2** (nhiều đáp án, 2 điểm): "Những lệnh nào tạo ra commit mới thay vì giữ nguyên commit cũ?"
  **`git commit --amend` 21 ✓** · **`git rebase main` 14 ✓** · `git log` 4 · `git status` 2 · đúng trọn bộ 11 · bỏ trống 2.
- **Câu 4** (tự luận, 5 điểm): "Khi nào nên dùng `merge`, khi nào nên dùng `rebase`? Nêu một rủi ro của `rebase`."
  Rubric: "2đ đúng bản chất merge · 2đ đúng bản chất rebase · 1đ nêu rủi ro: rebase branch đã push làm người khác lệch lịch sử." 9 bài, 4 bỏ trống, đã chấm 2/9.

## Cần giao
- Frame 1920×1080 cho các trạng thái 1–8; bản 1366×768 cho trạng thái 1 và 6.
- Ghi chú tương tác: vị trí và thứ tự hai nút, trạng thái hover/focus (rõ trên nền tối), hiệu ứng mở.
- Biến thể mới của component nếu cần (vd. `OptionTally` không có số liệu), mô tả props.

## Câu hỏi mở để designer đề xuất
- Hai nút đặt cạnh nhau ở chân cột phải, hay mỗi nút nằm ngay tại phần nó mở (nút "Hiện bài làm" trong vùng phương án, nút "Hiện đáp án" trong khung giải thích)?
- Có cần một chỉ báo nhỏ, cố định (vd. hai chấm "Bài làm ● Đáp án ○") để cả lớp biết trạng thái câu ngay khi nhìn lên?
- Thanh chọn câu `1…n` có nên đánh dấu câu nào đã mở bài làm/đáp án, để mentor biết câu nào đã bàn?
