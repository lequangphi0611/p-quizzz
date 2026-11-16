# S19 — Xin sửa bài tự luận: UI đã làm, nhờ designer xem

Mục đích: designer xem UI **đã được dựng** và cho ý kiến trước khi merge. Chưa có bản vẽ trước (chỉ dùng lại component sẵn có của p-quizzz Design System), nên đây là duyệt sau, không phải brief thiết kế mới.

## Thông tin nhánh

| | |
|---|---|
| Repo | https://github.com/lequangphi0611/p-quizzz |
| Branch | `claude/friendly-fermat-m4beaf` (chưa mở PR) |
| Commit | `73d06ba` (tính năng) · `f4c39bf` (làm rõ chỉ sửa tự luận) |
| Nhánh gốc | `main` tại `2389b04` |
| Story | [docs/stories/S19-edit-request.md](../stories/S19-edit-request.md) |
| Luật nghiệp vụ | [PRODUCT.md §7.21](../PRODUCT.md) |
| Chạy thử | `npm start` (cổng 3000) hoặc `npm run dev`; mentor: `http://localhost:<cổng>/admin/login` |

## Bối cảnh ngắn
Luật hiện có: mỗi member **một lượt** mỗi phiên, nộp là xong. Ngoại lệ mới: sau khi nộp (phiên còn chạy), member xin mentor mở lại **phần tự luận**. Mentor duyệt/từ chối. Được duyệt thì member sửa **tất cả** câu tự luận (không chọn từng câu), **một lần**, bấm "Xong" để đóng. Câu trắc nghiệm và điểm tự động không bao giờ đổi (để không dò đáp án qua việc xem điểm rồi sửa).

## Ba chỗ UI (ảnh trong `S19-assets/`)

### A. Member: thẻ "xin sửa bài" (file `MemberExamPage` → `EditRequestPanel.tsx`)
Nằm **dưới thẻ "Đã nộp bài"**, trên bảng xếp hạng, chỉ khi đề có tự luận và phiên đang chạy. Bốn trạng thái:

| Trạng thái | Nội dung |
|---|---|
| Chưa xin | Câu giải thích + nút phụ "Xin sửa bài tự luận" → mở form: ô **Lý do** (bắt buộc, ≤ 500 ký tự, đếm ký tự), nút "Gửi yêu cầu" / "Huỷ" |
| Chờ duyệt | Biểu tượng đồng hồ cát, "Đã gửi yêu cầu sửa bài", nhắc chỉ sửa được tự luận, trích lý do |
| Bị từ chối | Cảnh báo vàng "Mentor đã từ chối yêu cầu trước…" + nút "Gửi lại yêu cầu sửa bài" |
| Được duyệt | Tiêu đề "Sửa bài tự luận" + chỉ báo lưu; dòng "Mentor đã mở lại **N câu tự luận**; M câu trắc nghiệm giữ nguyên"; mỗi câu: nhãn "Câu 3/9 · tự luận", đề, ô nhập (mono, 10 dòng); nút chính "Xong, lưu bài" |
| Đã xong | Ghi chú "Bạn đã sửa bài tự luận… mỗi bài chỉ được mở lại một lần" |

Ảnh: `1-member-ask.png` (form đang mở), `2-member-waiting.png`, `3-member-editing.png`.

### B. Mentor: chuông thông báo (`NotificationBell.tsx`)
- Thêm loại thông báo **"xin sửa bài tự luận"** (biểu tượng bút, màu vàng như "chờ duyệt"), kèm lý do và hai nút **Duyệt** / **Từ chối** ngay trong chuông.
- Thêm dải vàng đầu danh sách "N yêu cầu sửa bài đang chờ bạn". Chấm vàng/badge trên chuông tính cả người chờ duyệt vào phòng lẫn yêu cầu sửa bài.
- Sau khi xử lý: dòng đổi thành nhãn kết quả ("Đã duyệt", "Đã từ chối", "Hết hiệu lực (phiên đã đóng)").
Ảnh: `4-mentor-bell.png`.

### C. Mentor: trang điều khiển phiên (`ParticipantsCard.tsx`)
Dưới dòng của người xin, thêm một **hàng nền vàng nhạt** cả bề ngang: "<Tên> xin sửa bài tự luận. Lý do: “…”" + nút Duyệt (chính) / Từ chối (phụ). Lý do dài tự xuống dòng. Ảnh: `5-mentor-session-page.png`.

## Điều gì cố ý chọn
- Không thêm component/token mới: dùng `PageCard`, `Button`, `TextField`, `ErrorMessage`, `SaveIndicator`, màu `--sun-*`.
- Phải ghi lý do: để mentor đủ thông tin quyết định (chỉ lúc xin, không lúc duyệt).
- Nhấn mạnh "chỉ tự luận, một lần" ở **mọi** trạng thái để member không hy vọng sửa trắc nghiệm.
- Từ chối vẫn cho gửi lại (mentor có thể từ chối tiếp).

## Chưa kiểm — nhờ designer chú ý
1. **Khổ điện thoại chưa chụp/kiểm** (mới 1000 và 1280 px). S18 yêu cầu dùng tốt cả hai. Cần xem ô sửa tự luận nhiều dòng, vị trí nút "Xong, lưu bài" (nên dính đáy hay ở cuối?).
2. **Tương phản** chữ nâu trên nền vàng nhạt ở hàng yêu cầu (C) chưa đo WCAG.
3. Phím tắt: màn sửa bài **không** dùng phím tắt của màn làm bài (`←/→`, `1–9`); chưa có nhu cầu nhưng cần biết có nên đồng nhất không.

## Câu hỏi cụ thể cho designer
1. Thẻ ở A nằm dưới thẻ điểm: đủ nổi hay cần nổi hơn (ví dụ viền/ màu nhấn) khi mentor vừa duyệt và member cần để ý ngay?
2. Chuông (B) có hai loại việc cần mentor xử lý (người chờ vào phòng, yêu cầu sửa bài): có nên phân nhóm/khác màu thay vì cùng vàng?
3. Hàng yêu cầu ở C: tách thành hàng riêng (như đang làm) hay đưa vào cột "Tiến độ" của dòng người đó?
4. Màn sửa (A, được duyệt): có nên hiển thị lại **bản đã nộp** để so sánh với bản đang sửa không? (Hiện không lưu bản cũ — nếu muốn, cần thêm dữ liệu.)

## Ngoài phạm vi lần này
Mentor chọn từng câu được mở; lịch sử yêu cầu bị từ chối; thông báo desktop riêng cho loại này.
