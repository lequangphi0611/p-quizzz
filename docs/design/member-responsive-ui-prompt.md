# Prompt thiết kế UI — Giao diện học viên cho cả máy tính và điện thoại

> Dán nguyên phần dưới đường kẻ vào công cụ thiết kế có **p-quizzz Design System**. Business: [PRODUCT.md §4.2–4.6](../PRODUCT.md). Màn hiện tại: `features/member-join/ui/MemberHomePage.tsx`, `features/member-exam/ui/MemberExamPage.tsx`, `features/member-review/ui`, khung `shared/ui/member/MemberLayout` (_đường dẫn sau epic #7_) (một cột rộng tối đa 640px).

---

Thiết kế lại **toàn bộ giao diện học viên** của p-quizzz để dùng tốt trên **cả máy tính (laptop/desktop) lẫn điện thoại**, dùng đúng **p-quizzz Design System** (token màu, typography, spacing, radius, motion, icon Lucide; component `Button`, `Card`, `ConfirmDialog`, `ErrorMessage`, `Spinner`, `StatusBadge`, `TextField`, `Icon`, `Markdown`, `AnswerOption`, `QuestionNav`, `QuestionPreview`, `SaveIndicator`, `MemberLayout`). Toàn bộ chữ trên UI bằng **tiếng Việt**. Giao diện sáng (không phải chủ đề tối của màn chiếu).

## Bối cảnh
p-quizzz là app luyện thi chạy trên máy một mentor; học viên vào qua mạng LAN bằng trình duyệt, **phần lớn dùng laptop/desktop**, một số dùng điện thoại. Không có tài khoản: học viên nhập **mã phòng 6 số + tên** cho mỗi phiên. Đề thường là kiến thức lập trình: câu hỏi có **code block**, đáp án là đoạn lệnh, câu **tự luận** có khi phải viết code nhiều dòng.

Hiện tại giao diện học viên là **một cột hẹp 640px** (thiết kế theo điện thoại). Trên máy tính nó vẫn chạy nhưng: phí chỗ, code block phải cuộn ngang, ô tự luận hẹp, danh sách câu và nút Nộp bài nằm xa nhau, không có phím tắt.

## Ràng buộc bắt buộc
- **Hai bố cục chính**: máy tính (thiết kế ở **1440×900**, kiểm tra lại **1280×720** và **1920×1080**) và điện thoại (**390×844**, kiểm tra **360×740**). Nêu rõ breakpoint chuyển bố cục và hành vi ở khoảng giữa (tablet ~768–1024).
- **Không tràn ngang** ở mọi khổ. Code block cuộn ngang **bên trong khối code**, không làm cả trang cuộn.
- **Không lộ đáp án trước khi phiên đóng**: trong lúc làm bài không có đúng/sai, không có lời giải, không có điểm từng câu.
- **Mỗi người chỉ làm 1 lần mỗi phiên**: không có nút "làm lại".
- Tự lưu liên tục; luôn thấy trạng thái lưu (`SaveIndicator`: Đang lưu… / Đã lưu / Lỗi lưu — thử lại) và trạng thái mất mạng.
- Font, icon có sẵn trong design system (app chạy offline).
- Trợ năng: điều khiển được hoàn toàn bằng bàn phím trên máy tính; vùng chạm ≥ 44px trên điện thoại; focus rõ; màu không phải tín hiệu duy nhất.

## Các màn / trạng thái cần thiết kế (mỗi màn: bản máy tính + bản điện thoại)
1. **Vào phòng**: ô mã phòng 6 số (có thể đã điền sẵn từ link `/?room=482913`) + ô tên. Lỗi tại chỗ: "Mã phòng không đúng", "Tên đã có người dùng", "Bạn nhập sai quá nhiều lần, thử lại sau N giây". Trạng thái "Chưa có phiên nào đang mở".
2. **Phòng chờ**: tên đề, tên của mình, số người đã vào, thông điệp "Chờ mentor bắt đầu". **Chờ duyệt** (vào muộn khi phiên đang chạy). **Bị mời ra khỏi phiên**.
3. **Bắt đầu làm bài**: thẻ tóm tắt (số câu, tổng điểm, "Mỗi người làm 1 lần") + nút "Bắt đầu làm bài".
4. **Đang làm bài** — màn quan trọng nhất:
   - **Máy tính**: đề xuất bố cục tận dụng chiều ngang, ví dụ: cột trái **danh sách câu** (`QuestionNav` dạng lưới/danh sách, đánh dấu đã trả lời / chưa trả lời) + tiến độ "Đã trả lời 7/12" + nút **Nộp bài** luôn thấy; vùng giữa **một câu** với đề rộng, code block đủ rộng để không phải cuộn ngang với đoạn code 80 ký tự; ô tự luận **cao, font monospace**, đủ cho ~20 dòng code. **Phím tắt** `←`/`→` câu trước/sau, `1`–`9` chọn phương án — tắt khi đang gõ trong ô nhập (xem "Đã quyết").
   - **Điện thoại**: một câu mỗi màn, `QuestionNav` gọn (cuộn ngang hoặc mở dạng bảng), thanh dưới cố định: Câu trước · Câu sau · Nộp bài.
   - Các loại câu: **một đáp án** (radio), **nhiều đáp án** (checkbox, ghi rõ "Chọn tất cả đáp án đúng"), **tự luận**. Phương án có thể chứa code inline.
   - Trạng thái: đang lưu, đã lưu, lỗi lưu, **mất mạng** ("Mất kết nối — bài vẫn được giữ, sẽ lưu lại khi có mạng"), câu chưa trả lời.
   - **Hộp xác nhận nộp bài**: nhắc số câu chưa trả lời ("Còn 2 câu chưa trả lời"); sau khi nộp không sửa được.
   - Phiên bị mentor đóng khi đang làm: bài tự nộp, chuyển sang màn kết quả.
5. **Đã nộp — chờ kết quả**: điểm phần trắc nghiệm (vd. "6/9 điểm"), ghi chú "Còn câu tự luận chờ mentor chấm" nếu có, nhãn **Tạm tính** cho đến khi mentor chốt; chưa có nút xem đáp án khi phiên chưa đóng.
6. **Phiên đã kết thúc**: điểm (chính thức / tạm tính), nút **"Xem lại bài"**.
7. **Xem lại bài** (sau khi phiên đóng): từng câu với lựa chọn của mình, đáp án đúng, lời giải, điểm từng câu; tự luận có điểm + nhận xét của mentor hoặc "Chờ chấm". **Máy tính**: cân nhắc danh sách câu bên cạnh để nhảy nhanh, đánh dấu câu sai. **Điện thoại**: cuộn dọc.
8. **Lỗi chung / đang tải**: mất kết nối tới máy mentor, có nút thử lại.

## Dữ liệu mẫu
Đề **Ôn tập Git cơ bản** — 4 câu, tổng 9 điểm:
- Câu 1 (một đáp án, 1đ): "Lệnh nào vừa tạo branch mới vừa chuyển sang branch đó?" — `git branch feature` · `git checkout -b feature` · `git merge feature` · `git fetch feature`.
- Câu 2 (nhiều đáp án, 2đ): "Những lệnh nào tạo ra commit mới thay vì giữ nguyên commit cũ?" — `git commit --amend` · `git rebase main` · `git log` · `git status`.
- Câu 3 (một đáp án, 1đ, có code block):
  ```bash
  echo "hello" > a.txt
  git add a.txt
  echo "world" >> a.txt
  ```
  "Sau khi chạy đoạn lệnh trên, `git status` hiển thị file `a.txt` ở trạng thái nào?"
- Câu 4 (tự luận, 5đ): "Khi nào nên dùng `merge`, khi nào nên dùng `rebase`? Nêu một rủi ro của `rebase`."
Thêm một câu giả có code block dài ~30 dòng, dòng dài ~100 ký tự, để thử bố cục máy tính.

## Cần giao
- Frame cho các màn 1–8, mỗi màn ở 1440×900 và 390×844; thêm 1280×720 cho màn 4 và 7.
- Mô tả breakpoint và cách bố cục co giãn giữa các khổ.
- Ghi chú tương tác: phím tắt trên máy tính, focus/hover, hành vi thanh cố định trên điện thoại, chuyển động (motion token, có biến thể giảm chuyển động).
- Nếu cần thay đổi component (vd. `MemberLayout` có biến thể rộng, `QuestionNav` dạng dọc cho sidebar), mô tả props và biến thể để bổ sung vào design system.

## Đã quyết (PO, 2026-11-15)
- Trên máy tính: **mỗi màn một câu**, kèm danh sách câu bên cạnh (không cuộn cả đề).
- Có phím tắt trên máy tính (`←`/`→` câu trước/sau, `1`–`9` chọn phương án), nhưng **tắt khi con trỏ đang ở ô nhập** (ô tự luận, ô tên…), để gõ không bị nhảy câu hay chọn nhầm.

## Câu hỏi mở để designer đề xuất
- Chiều rộng tối đa của vùng đọc đề trên màn rất rộng (1920px+) để chữ không quá dài dòng mà code vẫn đủ chỗ.
- Cách hiển thị gợi ý phím tắt cho người mới mà không rối giao diện.
