# Prompt thiết kế UI — Trang chia sẻ các phiên đã thi (S31)

> Dán nguyên phần dưới đường kẻ vào công cụ thiết kế có **p-quizzz Design System**. Spec: [S31-shared-sessions.md](../stories/S31-shared-sessions.md), business: [PRODUCT.md §7.33](../PRODUCT.md). Màn nền đã có thiết kế: giao diện học viên ([member-responsive-ui-prompt.md](member-responsive-ui-prompt.md)), trang "Xem lại bài" (`features/member-review/ui`, `shared/ui/ReviewQuestions`), trang xem lại phiên của mentor (`/admin/sessions/:id/review`).

---

Thiết kế **trang chia sẻ các phiên đã thi** của p-quizzz và các chỗ mentor bật/tắt chia sẻ, dùng đúng **p-quizzz Design System** (token màu, typography, spacing, radius, motion, icon Lucide; component `Button`, `Card`, `ConfirmDialog`, `ErrorMessage`, `Spinner`, `StatusBadge`, `Icon`, `Markdown`, `AnswerOption`, `QuestionNav`, `ReviewQuestions`, `MemberLayout`). Giao diện sáng như giao diện học viên. Toàn bộ chữ trên UI bằng **tiếng Việt**.

## Bối cảnh
p-quizzz là app luyện thi chạy trên máy một mentor; học viên vào qua mạng LAN bằng trình duyệt (**phần lớn laptop/desktop, một số điện thoại**). Không có tài khoản. Mỗi **phiên** là một lần một nhóm thi một **đề**; một đề có thể được nhiều nhóm thi ở nhiều phiên.

Người **vắng buổi** hoặc **mới vào dự án** muốn ôn đúng phần lớp đã làm. Mentor chọn **chia sẻ** một số phiên đã kết thúc. Ai có **một link chung** (mentor gửi qua chat) mở ra thấy **danh sách các phiên đang được chia sẻ**, bấm vào một phiên để xem **đề, đáp án, lời giải và tỉ lệ cả lớp chọn từng phương án**, rồi quay lại danh sách.

Người xem **không thi, không có điểm, không có tên** trong phiên. Đây là trang **đọc để ôn**, không phải bảng thành tích.

## Ràng buộc bắt buộc
- **Không bao giờ có** ở trang chia sẻ: tên học viên, email, tên nhóm, **tên phiên** (chỉ mentor thấy), bảng xếp hạng, điểm của ai, bài làm hay lựa chọn của từng người, bài tự luận, lý do, nhận xét, gợi ý AI. Chỉ có số liệu gộp của cả lớp.
- Mỗi phiên chỉ được nhận diện bằng **tên đề + ngày giờ thi + số câu**. Hai phiên cùng đề (hai nhóm) phải phân biệt được bằng ngày giờ.
- Lời giải **hiện sẵn** (không cần bấm), khác chế độ thảo luận.
- Phiên có **dưới 3 bài nộp** thì **không hiện tỉ lệ** (tỉ lệ khi đó chính là bài của từng người); thay bằng một dòng trung tính.
- Trang ghi rõ người xem **chỉ đang xem lại, không có điểm**, nhẹ nhàng, không làm người xem thấy bị loại trừ.
- Link sai hoặc đã bị mentor đổi: **một thông báo trung tính**, không cho biết từng có trang chia sẻ hay không. Phải phân biệt được với "phiên này không còn được chia sẻ" (link còn đúng, chỉ phiên đó bị tắt).
- Dùng tốt trên **laptop (1440×900, 1280×800)** và **điện thoại (390×844)**; code block không tràn ngang trang (cuộn trong khối). Màu không là tín hiệu duy nhất (đáp án đúng có icon ✓ + chữ).
- Font và icon có sẵn trong design system (app chạy offline, không tài nguyên ngoài).

## Màn cần thiết kế

### A. Trang danh sách (người có link)
1. **Có phiên**: tiêu đề trang (gợi ý "Phiên đã thi được chia sẻ"), dòng giải thích ngắn, danh sách mới nhất trước. Mỗi dòng: tên đề, ngày giờ thi, số câu; bấm cả dòng để mở. Thể hiện hai dòng cùng tên đề khác ngày.
2. **Rỗng**: "Chưa có phiên nào được chia sẻ" + một câu gợi ý hỏi mentor.
3. **Đang tải** và **lỗi kết nối** (máy mentor tắt, rớt Wi-Fi): có nút thử lại.
4. **Link không còn hiệu lực** (sai hoặc đã đổi): thông báo trung tính, gợi ý xin mentor link mới.

### B. Trang chi tiết một phiên
5. **Phiên đầy đủ**: đầu trang có nút **quay lại danh sách**, tên đề, ngày giờ thi, số câu, số bài nộp, và dòng "Bạn đang xem lại, không có điểm". Nội dung theo **thứ tự đề gốc**:
   - Câu một đáp án: đề (có code block), các phương án, đáp án đúng (✓ + "Đáp án đúng"), **tỉ lệ / số người chọn** từng phương án, số người bỏ trống, khối Giải thích.
   - Câu nhiều đáp án: như trên, ghi rõ "Chọn tất cả đáp án đúng"; tỉ lệ theo từng phương án.
   - Câu tự luận: đề, điểm tối đa, khối "Đáp án mẫu / tiêu chí chấm" (Markdown, có thể là danh sách tiêu chí kèm điểm). Không có bài của ai.
   - Đề dài (20–30 câu): cách điều hướng nhanh giữa các câu (designer chọn: một trang cuộn có mục lục, hay từng câu kèm `QuestionNav`), và nút quay lại luôn dễ thấy.
6. **Phiên ít bài nộp (< 3)**: không có tỉ lệ; một dòng "Phiên có ít bài nộp nên không hiện tỉ lệ chọn". Đáp án và giải thích vẫn hiện.
7. **Phiên không còn được chia sẻ** (mở link chi tiết cũ, hoặc mentor tắt khi đang xem rồi tải lại): thông báo + nút về danh sách.
8. **Đang tải / lỗi** như màn A.

### C. Phía mentor (giao diện quản trị, dùng lại bố cục hiện có)
9. Trên **trang xem lại phiên**: công tắc **"Chia sẻ phiên này"** và trạng thái (đang chia sẻ từ lúc nào). Phiên chưa kết thúc: công tắc bị khoá kèm lý do "Chỉ chia sẻ được sau khi đóng phiên".
10. **Hộp xác nhận khi bật**: nhắc người xem sẽ biết đáp án, ai sắp thi đề này không nên được xem; liệt kê ngắn trang chia sẻ hiện gì và **không** hiện gì. Biến thể **cảnh báo mạnh** khi đề này còn phiên chưa đóng ("Đề này còn 2 phiên chưa kết thúc").
11. **Khu "Link chia sẻ"** (designer đề xuất vị trí: đầu trang Lịch sử phiên, hoặc một trang/khối riêng): link đầy đủ, nút **Sao chép** (có phản hồi "Đã sao chép"), số phiên đang chia sẻ, nút **"Đổi link"** + hộp xác nhận ("Mọi người đang có link cũ sẽ không mở được nữa; bạn cần gửi lại link mới").
12. Trong **danh sách phiên** của mentor: dấu nhỏ cho phiên đang được chia sẻ.

### D. Trang "Xem lại bài" của học viên đã thi
13. Một dòng thông báo trung tính: "Mentor đang chia sẻ đề và lời giải của phiên này, không kèm tên, điểm hay bài làm của ai."

## Dữ liệu mẫu (giả lập)
Danh sách (4 phiên đang chia sẻ):
- **Ôn tập React hooks**, 19/11/2026 14:00, 20 câu.
- **Ôn tập React hooks**, 12/11/2026 09:30, 20 câu (nhóm khác, cùng đề).
- **Git cơ bản: branch & merge**, 05/11/2026 15:00, 12 câu.
- **TypeScript: generics và narrowing — bài luyện tập số 3 dành cho nhóm mới**, 28/10/2026 10:00, 30 câu (tên đề dài, kiểm tra xuống dòng).

Chi tiết "Ôn tập React hooks" 19/11, 28 bài nộp:
- **Câu 1** (một đáp án, 1 điểm) — "Trang có khoảng 50 sản phẩm (`products`, lấy từ props) và ô tìm kiếm (`query`, là state). Cách nào phù hợp nhất để có danh sách đã lọc?"
  - A. `useState` + `useEffect` để `setVisible(products.filter(...))` — 11 người
  - **B. Viết thẳng `const visible = products.filter(p => p.name.includes(query));` trong thân component — 14 người ✓**
  - C. Bắt buộc bọc trong `useMemo` — 3 người
  - D. Lưu kết quả vào `useRef` — 0 người · Bỏ trống: 0
  - Giải thích: "Dữ liệu suy ra được từ props/state thì tính ngay khi render. Thêm state + effect gây một lần render thừa và dễ lệch dữ liệu; 50 phần tử thì chưa cần `useMemo`."
- **Câu 2** (nhiều đáp án, 2 điểm) — "Những trường hợp nào **nên** dùng `useEffect`?" — đúng A, C. Theo phương án: A 22 · B 9 · C 24 · D 3; bỏ trống 2.
- **Câu 3** (tự luận, 4 điểm, có code block 12 dòng trong đề) — "Viết custom hook `useDebounce(value, delay)`…". Đáp án mẫu: đoạn code + 3 tiêu chí (2đ / 1đ / 1đ).

Chi tiết "Git cơ bản" 05/11: **2 bài nộp** → trạng thái 6.

## Cần giao
- Laptop 1440×900 cho trạng thái 1–13; điện thoại 390×844 cho 1, 2, 4, 5, 6, 7.
- Ghi chú tương tác: quay lại danh sách giữ vị trí cuộn; link chi tiết mở trực tiếp được; focus rõ ràng, điều hướng được bằng bàn phím.
- Nếu cần component mới (ví dụ "thanh tỉ lệ chọn của lớp", "dòng phiên chia sẻ"), mô tả props và biến thể. Tỉ lệ chọn nên dùng lại cách hiển thị phân bố của chế độ thảo luận nếu đọc tốt ở khổ nhỏ.

## Câu hỏi mở để designer đề xuất
- Chi tiết phiên: **một trang cuộn** (có mục lục câu) hay **từng câu một** như "Xem lại bài"?
- Tỉ lệ chọn hiện **số người**, **phần trăm**, hay cả hai?
- Khu "Link chia sẻ" của mentor đặt ở đâu cho dễ tìm mà không chiếm chỗ trang Lịch sử phiên?
