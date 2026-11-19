# Prompt thiết kế UI — Khối "Lý do của lớp" trong chế độ thảo luận (S30)

> Dán nguyên phần dưới đường kẻ vào công cụ thiết kế có **p-quizzz Design System**. Spec đầy đủ: [S30-choice-reason.md](../stories/S30-choice-reason.md), business: [PRODUCT.md §7.32](../PRODUCT.md). Màn nền là màn thảo luận của S17 ([S17-discussion-ui-prompt.md](S17-discussion-ui-prompt.md)), đã có bản thiết kế.

---

Thiết kế thêm khối **"Lý do của lớp"** cho màn **"Thảo luận"** đã có của p-quizzz, dùng đúng **p-quizzz Design System** (token màu, typography, spacing, radius, motion, icon Lucide, và các component sẵn có như `Button`, `Card`, `Markdown`, `AnswerOption`, `QuestionNav`, `ScreenLayout`, `Spinner`, `ErrorMessage`). Giữ nguyên bố cục, thanh trên, thanh chọn câu và cách hiển thị phân bố lựa chọn của màn thảo luận hiện tại; chỉ thêm khối mới và những chỗ cần đổi để chứa nó. Toàn bộ chữ trên UI bằng **tiếng Việt**.

## Bối cảnh
p-quizzz là app luyện thi chạy trên máy một mentor; học viên vào bằng laptop hoặc điện thoại qua mạng LAN. Một số câu trắc nghiệm trong đề được đánh dấu **"hỏi lý do"**: khi làm bài, học viên chọn đáp án rồi bắt buộc gõ **một câu lý do ngắn (tối đa 200 ký tự)**. Lý do **không tính điểm**; nó giúp mentor hiểu học viên nghĩ gì, đặc biệt là bắt được người **chọn đúng nhờ đoán mò** và **chỗ hiểu nhầm** khiến nhiều người dồn vào một phương án sai.

Sau khi đóng phiên, mentor mở màn **Thảo luận** và **chiếu lên máy chiếu**, đi từng câu với cả lớp. Ở câu có hỏi lý do, mentor bấm để hiện **toàn bộ lý do của lớp, nhóm theo phương án đã chọn, không có tên**, rồi cho hai phe tranh luận.

Người thao tác: mentor, dùng chuột/bàn phím trên laptop, màn hình laptop chính là màn được chiếu.
Người xem: 10–30 học viên ngồi cách màn chiếu 3–8 m.

## Ràng buộc bắt buộc
- **Không có tên học viên, không có nút "hiện tên"**, không có số thứ tự gợi ý người viết (không "Bài #3" cho lý do). Lý do hiện theo thứ tự đã trộn, cố định khi tải lại trang.
- **Mặc định ẩn**: mỗi lần chuyển sang câu khác, khối lý do ẩn lại. Mentor bấm nút **"Hiện lý do"** (phím tắt `R`) mới hiện. Nút này **tách riêng** với nút "Hiện đáp án" (phím `Space`): mentor có thể hiện lý do trước để lớp tranh luận, rồi mới hiện đáp án, hoặc ngược lại.
- Khi **đáp án đang ẩn**, khối lý do không được lộ phương án nào đúng (không màu xanh, không ✓, không xếp nhóm đúng lên đầu). Thứ tự nhóm = thứ tự phương án như ở phần phân bố lựa chọn.
- Khi **đã hiện đáp án**, nhóm của phương án đúng được đánh dấu giống phần phân bố (xanh + icon ✓ + chữ "Đáp án đúng"); các nhóm sai giữ trung tính (không tô đỏ).
- **Đọc được từ xa**: thiết kế cho khung **1920×1080** (chữ lý do ≥ 28 px, tiêu đề nhóm ≥ 32 px), kiểm tra lại ở **1366×768**. Không tràn ngang. Lý do dài 200 ký tự phải đọc được, không cắt mất chữ.
- Dùng **chủ đề tối của màn chiếu** (`--screen-bg`, `--screen-panel`, `--screen-line`, `--screen-text`, `--screen-meta`), tương phản cao; màu không phải tín hiệu duy nhất.
- Font và icon đã có sẵn trong design system (app chạy offline, không dùng tài nguyên ngoài).
- Câu **không** hỏi lý do thì không có khối này và không có nút "Hiện lý do".
- Học viên có thể đã gõ lý do vu vơ ("vì đúng", "đoán"): hiển thị nguyên văn, không lọc, không chấm.

## Phím tắt
Hiện có: `← →` câu · `Space` đáp án · `S` "Cần bàn trước" · `J K` bài tự luận · `Esc` thoát. Thêm: **`R` hiện/ẩn lý do**. Cập nhật dòng gợi ý phím ở góc dưới (chỉ hiện `R` ở câu có hỏi lý do).

## Các trạng thái cần thiết kế
1. **Câu có hỏi lý do — lý do đang ẩn, đáp án đang ẩn.** Màn câu một đáp án như hiện tại (đề, phân bố lựa chọn), thêm nút **"Hiện lý do"** cạnh "Hiện đáp án", kèm số đếm trung tính "27 lý do". Không lộ nội dung nào.
2. **Đã hiện lý do, đáp án vẫn ẩn.** Khối "Lý do của lớp": mỗi phương án có người chọn là một nhóm, tiêu đề nhóm = nhãn phương án (chữ/code như ở phân bố) + "12 lý do". Trong nhóm là các thẻ lý do ngắn, ẩn danh. Không có dấu đúng/sai. Nút đổi thành "Ẩn lý do".
3. **Đã hiện lý do và đã hiện đáp án.** Như (2), nhóm đúng có dấu "Đáp án đúng"; khối Giải thích của câu vẫn hiện như hiện tại. Thể hiện được bố cục khi cả phân bố, giải thích và lý do cùng có mặt (có thể cần cuộn hoặc thu gọn một phần, designer đề xuất).
4. **Nhiều lý do**: một nhóm có 14 lý do, trong đó vài lý do dài gần 200 ký tự và một lý do có `code` inline. Cách xem hết mà vẫn đọc được từ xa (cuộn trong khối, chia cột, thu gọn nhóm…).
5. **Nhóm ít / không có**: phương án không ai chọn thì không có nhóm (hoặc một dòng "Không ai chọn", designer chọn). Phương án có người chọn nhưng đều nộp tự động khi hết giờ mà chưa viết lý do → dòng "2 người chọn nhưng chưa ghi lý do" (không thẻ trống).
6. **Câu nhiều đáp án**: lý do gắn với **cả tổ hợp** đã chọn (ví dụ "A + C"). Đề xuất cách nhóm: theo từng tổ hợp đã chọn, các tổ hợp hiếm gom lại; tiêu đề nhóm phải đọc được từ xa.
7. **Không có lý do nào**: câu có hỏi lý do nhưng không ai viết (mọi người bỏ trống câu hoặc nộp tự động) → nút "Hiện lý do" vẫn có, khối hiện "Chưa có lý do nào cho câu này".
8. **Đang tải / lỗi tải**: dùng chung trạng thái tải và lỗi của màn thảo luận.

## Dữ liệu mẫu (giả lập, 30 bài được tính)
Đề: **Ôn tập React hooks**.
- **Câu 1.1** (một đáp án, 1 điểm, hỏi lý do) — "Trang có khoảng 50 sản phẩm (`products`, lấy từ props) và một ô tìm kiếm (`query`, là state). Danh sách hiển thị chỉ gồm các sản phẩm có tên chứa `query`. Cách nào phù hợp nhất để có danh sách đã lọc?"
  - A. Tạo `const [visible, setVisible] = useState([])` rồi dùng `useEffect` để `setVisible(products.filter(...))` mỗi khi `products` hoặc `query` đổi. — **11 người**
  - **B. Viết thẳng `const visible = products.filter(p => p.name.includes(query));` trong thân component. — 14 người ✓**
  - C. Bắt buộc bọc trong `useMemo`, vì nếu không thì phép lọc chạy lại mỗi lần render. — 3 người
  - D. Lưu kết quả lọc vào `useRef` để tránh re-render. — 0 người
  - Bỏ trống: 2.
  - Giải thích: "Dữ liệu suy ra được từ props/state thì tính ngay khi render. Thêm state + effect gây một lần render thừa và dễ lệch dữ liệu; 50 phần tử thì lọc lại mỗi lần render không đáng kể, chưa cần `useMemo`."
  - Lý do mẫu:
    - Nhóm A: "Dữ liệu thay đổi thì phải để vào state mới re-render được" · "Lọc là side effect nên phải để trong useEffect" · "Thầy hay dùng useEffect cho mấy cái kiểu này" · "Để tránh lọc lại mỗi lần render, chỉ lọc khi query đổi" · "vì đúng"
    - Nhóm B: "visible tính được từ products và query nên không cần state riêng" · "Tính khi render là đủ, thêm state thì phải đồng bộ, dễ lệch" · "đoán" · "B ngắn nhất" · "React docs: You might not need an effect, dữ liệu suy ra thì tính trực tiếp" · một lý do dài ~190 ký tự
    - Nhóm C: "Không useMemo thì mỗi lần gõ phím sẽ lọc lại, chậm" · "`useMemo` là cách chuẩn để cache kết quả tính toán"
    - 1 người chọn A nộp tự động khi hết giờ, chưa ghi lý do.
- **Câu 1.4** (nhiều đáp án, 2 điểm, hỏi lý do) — "Những trường hợp nào **nên** dùng `useEffect`?" — đúng: A (đồng bộ với API trình duyệt), C (gọi API khi component hiện ra). Tổ hợp đã chọn: "A + C" 12 · "A + B + C" 7 · "C" 6 · "B + D" 2 · bỏ trống 3. Mỗi tổ hợp 1–4 lý do mẫu.
- **Câu 1.2** (một đáp án, **không** hỏi lý do): để kiểm tra trạng thái không có nút/khối lý do.

## Cần giao
- Frame 1920×1080 cho trạng thái 1–7 (trạng thái 8 dùng lại của S17), và bản 1366×768 cho trạng thái 3 và 4.
- Ghi chú tương tác: nút + phím `R`, hiệu ứng hiện/ẩn (motion token, ngắn, có biến thể giảm chuyển động), focus rõ trên nền tối, khối tự ẩn khi đổi câu.
- Nếu cần component mới (ví dụ "nhóm lý do", "thẻ lý do ẩn danh"), mô tả props và biến thể để bổ sung vào design system.

## Câu hỏi mở để designer đề xuất
- Khối lý do đặt **dưới** phân bố lựa chọn, **thay chỗ** phân bố khi đang mở, hay thành **cột bên cạnh** từng phương án?
- Có nên cho mentor **thu gọn/mở rộng từng nhóm** để tập trung vào một phe khi tranh luận (vẫn ẩn danh)?
- Câu nhiều đáp án: nhóm theo tổ hợp như đề xuất ở trạng thái 6, hay cách khác dễ đọc hơn từ xa?
