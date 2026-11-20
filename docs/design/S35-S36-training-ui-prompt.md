# Prompt thiết kế UI: Buổi training AI (S35, S36)

> Dán nguyên phần dưới đường kẻ vào công cụ thiết kế có **p-quizzz Design System**. Business: [PRODUCT.md §7.34](../PRODUCT.md). Spec: [S35-training-mentor-ui.md](../stories/S35-training-mentor-ui.md), [S36-training-member-ui.md](../stories/S36-training-member-ui.md). Contract: [architecture.md](../architecture.md) §5 "Buổi training AI", §11.8. Kết quả thử kỹ thuật: [spikes/claude-code-hooks.md](../spikes/claude-code-hooks.md). Màn tham chiếu hiện có: nhập mã phòng `features/member-join/ui`, trang điều khiển phiên `features/session-admin/ui`.

---

Thiết kế tính năng mới **"Buổi training AI"** của p-quizzz: trang cho **mentor** theo dõi cách học viên dùng Claude Code (công cụ lập trình bằng AI chạy trong terminal), và luồng cho **học viên** đồng ý, cài kết nối, rồi gỡ khi xong. Dùng đúng **p-quizzz Design System** (token màu, typography, spacing, radius, motion, icon Lucide; component `Button`, `Card`, `ConfirmDialog`, `ErrorMessage`, `Spinner`, `StatusBadge`, `TextField`, `Icon`, `Kbd`, `SegmentedControl`, `ConnectionStatus`, `MemberLayout`, `RulesCard`, `Switch`, kiểu bảng `tableStyles`). Toàn bộ chữ trên UI bằng **tiếng Việt**. Giao diện sáng cho cả mentor và học viên.

## Bối cảnh
p-quizzz chạy trên máy một mentor; học viên vào qua mạng LAN bằng trình duyệt. Trong buổi dạy dùng Claude Code, mentor muốn biết học viên **giao việc cho AI thế nào**: gõ prompt gì, Claude chạy lệnh gì, lệnh **pass hay fail**, mất bao lâu. Mục đích là phát hiện chỗ sai để góp ý, thay vì đi vòng quanh phòng nhìn từng màn hình.

Cách hoạt động:
1. Mentor tạo **buổi training**, chiếu **mã 6 chữ số** cho lớp.
2. Học viên gõ mã ở trang đầu của p-quizzz (chung ô với mã phòng thi), nhập tên, **đọc và đồng ý** những gì sẽ được gửi.
3. App đưa cho mỗi học viên một **đoạn cấu hình riêng**. Học viên thêm đoạn đó vào file `.claude/settings.local.json` trong **thư mục bài tập training** (không phải repo công ty, không phải cấu hình cấp máy). Cách dễ nhất: sao chép một câu nhờ chính Claude Code ghép đoạn cấu hình vào file.
4. Từ đó, mỗi prompt và mỗi lần Claude dùng công cụ được gửi về máy mentor. Học viên thấy **"Đã nhận tín hiệu"**.
5. Hết giờ, mentor bấm **"Dừng thu"**: server không nhận thêm gì. Học viên được hướng dẫn **gỡ** đoạn cấu hình rồi **kiểm tra đã gỡ**.
6. Mentor xem lại xong thì bấm **"Kết thúc"**: **toàn bộ dữ liệu bị xoá vĩnh viễn**, chỉ còn tên buổi, thời gian, số người.

Dữ liệu thu: prompt; mỗi lần dùng công cụ: tên công cụ (Bash, Edit, Write, Read…), câu lệnh hoặc tên file, pass/fail, thời gian chạy, **output** của lệnh và **nội dung thay đổi file** (output và thay đổi dài chỉ giữ phần đầu và phần cuối, có dòng "đã lược bỏ N dòng"). **Không** thu câu trả lời của Claude. **Học viên không xem lại được dữ liệu đã thu**, chỉ thấy trạng thái kết nối của mình.

## Ràng buộc bắt buộc
- **Không phải công cụ giám sát hay chấm điểm.** Không có điểm, xếp hạng, so sánh "prompt giỏi/dở", không sắp học viên theo số lỗi. Cờ **"có thể đang kẹt"** (cùng một lệnh lỗi từ 3 lần liên tiếp) chỉ là gợi ý cho mentor; giọng văn trung tính, không quy kết.
- **Màn đồng ý phải trung thực và cụ thể**: liệt kê từng loại dữ liệu, nói rõ output và nội dung file **có thể chứa mật khẩu hay mã bí mật**, chỉ mentor xem, học viên không xem lại được, xoá khi mentor Kết thúc, rút lại được bất cứ lúc nào. Không dùng giao diện "dark pattern" (nút đồng ý nổi bật, nút từ chối mờ, chữ nhỏ). Không đồng ý thì vẫn học bình thường, và mentor không thấy ai đã từ chối.
- **Cài đặt là phần khó nhất với học viên**: chữ rõ, từng bước, đoạn mã đọc được (font mono, nút sao chép), nhấn mạnh **"ghép vào, đừng ghi đè"** và **"chỉ trong thư mục bài tập"**. Học viên làm trên laptop (cần terminal); điện thoại chỉ cần đọc được trạng thái.
- **Ba trạng thái kết nối** của học viên phải phân biệt ngay, không chỉ bằng màu: *Chưa nhận tín hiệu* · *Đã nhận tín hiệu* · *Đã gỡ*. Phía mentor thêm: *Vẫn gửi sau khi dừng* (cần nhắc gỡ).
- **Mentor đọc được nhiều mà không ngợp**: 20 học viên × vài trăm lệnh mỗi buổi. Dòng thời gian mặc định **không hiện output**; mỗi lệnh một dòng (✓/✗, thời gian, câu lệnh rút gọn) + một dòng tóm tắt (lệnh lỗi: 2–3 dòng lỗi; lệnh thành công: dòng cuối). Bấm **"Xem output"** / **"Xem thay đổi"** mới tải nội dung vào khung cuộn riêng.
- Output có thể rất dài, nhiều ký tự lạ, màu ANSI đã bị bỏ: hiển thị font mono, xuống dòng hợp lý, có dòng phân cách "… đã lược bỏ 9 600 dòng …" giữa phần đầu và phần cuối.
- **Không có gì lên màn hình chiếu.** Trang mentor có thể đang được chiếu: mã phòng hiển thị lớn được, nhưng dòng thời gian của học viên nên có trạng thái "ẩn nội dung" nhanh (ví dụ một nút hoặc phím tắt) để mentor bật khi lỡ chiếu.
- Hai thao tác không quay lại được, cần hộp xác nhận rõ hậu quả: **Dừng thu** (không mở thu lại được) và **Kết thúc** (xoá vĩnh viễn). "Mời ra" một học viên cũng xoá dữ liệu của người đó.
- Trợ năng: thông báo cho trình đọc màn hình khi "Đã nhận tín hiệu", khi mentor dừng thu, khi kết quả kiểm tra gỡ; mọi thao tác dùng được bằng bàn phím; nút ≥ 44px trên điện thoại.
- Font, icon có sẵn trong design system (app chạy offline).

## Các màn / trạng thái cần thiết kế

**Học viên** (1440×900; các màn 1, 5, 7, 9 thêm 390×844)
1. **Nhập tên + đồng ý** (sau khi gõ mã ở trang đầu): tên buổi, ô tên, khối "Những gì được gửi về máy mentor" (liệt kê như trên) và "Những gì không gửi" (câu trả lời của Claude, việc làm ngoài thư mục bài tập), ô tick "Tôi đã đọc và đồng ý", nút "Đồng ý và tiếp tục", nút "Không tham gia". Lỗi: tên đã có người dùng.
2. **Cài kết nối, bước 1: chọn thư mục**: giải thích phải dùng thư mục bài tập riêng.
3. **Cài kết nối, bước 2: thêm cấu hình**: hai cách đặt cạnh nhau hoặc dạng tab. **(A) Nhờ Claude Code** (khuyến nghị): khối câu nhờ có nút sao chép. **(B) Tự ghép**: khối JSON có nút sao chép, đường dẫn file `.claude/settings.local.json`, cảnh báo "ghép vào, đừng ghi đè" và "không đặt vào ~/.claude/settings.json". Nhắc: lần đầu mở thư mục, Claude Code có thể hỏi có tin cậy thư mục không, hãy đồng ý.
4. **Cài kết nối, bước 3: chờ tín hiệu**: "Gõ một prompt bất kỳ trong Claude Code"; trạng thái đang chờ (có `Spinner`); sau khoảng 1 phút chưa thấy thì hiện gợi ý: sai thư mục, chưa mở lại Claude Code, máy có proxy.
5. **Đã nhận tín hiệu / đang thu**: trạng thái rõ, tên buổi, nhắc ngắn những gì đang được gửi, nút "Rút lại đồng ý".
6. **Hộp xác nhận rút lại đồng ý**: dữ liệu của bạn sẽ bị xoá; hãy gỡ đoạn cấu hình (kèm hướng dẫn ngắn).
7. **Mentor đã dừng thu → gỡ kết nối**: thông báo nổi bật; hướng dẫn gỡ (sao chép câu nhờ Claude Code gỡ, hoặc tự xoá đúng đoạn đã thêm); nút "Kiểm tra đã gỡ".
8. **Kiểm tra gỡ**: "Gõ một prompt bất kỳ trong Claude Code, rồi bấm Xong" (nút Xong khoá trong 5 giây đầu, có đếm). Kết quả **Đã gỡ** (hoàn tất) hoặc **Vẫn còn nhận được tín hiệu** (hướng dẫn kiểm tra bằng lệnh `/hooks`, thử lại).
9. **Buổi đã kết thúc / không còn dữ liệu**: màn ngắn, quay về trang đầu. Thêm trạng thái **mất kết nối với máy mentor** (`ConnectionStatus`).

**Mentor** (1440×900, giao diện quản trị hiện có, kiểm tra 1280×800)
10. **Danh sách buổi training** + tạo buổi (chỉ cần tên): mỗi dòng có tên, trạng thái (*Đang thu* / *Đã dừng thu* / *Đã kết thúc*), thời gian, số người. Trạng thái rỗng.
11. **Trang buổi đang thu, chưa ai vào**: mã phòng lớn + link (để chiếu), hướng dẫn ngắn cho mentor đọc cho lớp.
12. **Trang buổi đang thu, có học viên**: bảng học viên (tên, trạng thái kết nối, số prompt / số lệnh / số lệnh lỗi, lần cuối thấy, cờ "có thể đang kẹt") ở một bên; chọn một học viên → **dòng thời gian** ở bên còn lại. Có nút **ẩn nội dung** khi đang chiếu. Nút "Dừng thu".
13. **Dòng thời gian chi tiết** (trạng thái quan trọng nhất): prompt (khối nổi bật, giữ xuống dòng), dưới đó các lệnh của lượt đó: icon ✓/✗, tên công cụ, câu lệnh hoặc tên file rút gọn (bấm để xem đầy đủ), thời gian (48 ms / 3,2 s / 1 phút 05 s), dòng tóm tắt. Nhóm theo prompt; nhiều phiên Claude Code của cùng một người thì có dấu phân cách. Đánh dấu chỗ bắt đầu chuỗi "có thể đang kẹt". Tải thêm khi cuộn.
14. **Xem output / xem thay đổi**: khung cuộn riêng (panel bên hoặc mở rộng tại chỗ, đề xuất cách nào tốt hơn), font mono, phần đầu, dòng "… đã lược bỏ N dòng …", phần cuối; thay đổi file hiển thị dòng `-` / `+`. Trạng thái đang tải, lỗi.
15. **Hộp xác nhận Dừng thu**: không mở lại được; học viên sẽ được hướng dẫn gỡ.
16. **Trang buổi đã dừng thu**: "Đã gỡ 14/20", "Còn 3 máy vẫn gửi" (số đếm, gợi ý mentor nhắc lớp), bảng học viên vẫn xem được dòng thời gian, nút "Kết thúc".
17. **Hộp xác nhận Kết thúc**: xoá vĩnh viễn mọi prompt, lệnh, output; gợi ý xem lại trước khi bấm.
18. **Trang buổi đã kết thúc**: chỉ tên, thời gian, số người; giải thích dữ liệu đã xoá.
19. **Hộp xác nhận Mời ra** một học viên.

## Dữ liệu mẫu
Buổi **"Claude Code buổi 2: viết test"**, mã **482913**, bắt đầu 14:00, hiện tại 14:37. 6 học viên: An (đang thu, 12 prompt, 41 lệnh, 3 lỗi), Bình (đang thu, có cờ **có thể đang kẹt**: `npm test` lỗi 4 lần liên tiếp), Chi (chưa nhận tín hiệu), Dũng (đang thu, 5 prompt, 9 lệnh), Hà (lần cuối thấy 14:21), Khoa (đang thu).
Dòng thời gian của Bình:
- Prompt 14:30: "viết test cho hàm tính tổng giỏ hàng, chạy test luôn"
  - ✓ Read `src/cart.ts` · 12 ms
  - ✓ Write `src/cart.test.ts` · 8 ms (thay đổi 38 dòng)
  - ✗ Bash `npm test` · 3,4 s · "FAIL src/cart.test.ts › tính tổng khi có mã giảm giá · Expected: 90 · Received: 100"
  - ✓ Edit `src/cart.test.ts` · 6 ms
  - ✗ Bash `npm test` · 3,1 s · (cùng lỗi)
- Prompt 14:34: "sửa đi"
  - ✗ Bash `npm test` · 3,3 s · … (output đầy đủ 1 240 dòng)
Buổi đã dừng thu: 20 học viên, đã gỡ 14, còn 3 máy vẫn gửi.

## Cần giao
- Frame cho các trạng thái 1–19 ở các khổ đã nêu.
- Ghi chú tương tác: chọn học viên, tải thêm dòng thời gian, mở/đóng output, ẩn nội dung khi chiếu (đề xuất phím tắt), cập nhật realtime (học viên mới, sự kiện mới) mà không làm nhảy vị trí đang đọc.
- Nếu cần component mới (ví dụ `CodeBlock` có nút sao chép, `TimelineItem`, `OutputViewer`, `StepList` cho các bước cài), mô tả props và biến thể để bổ sung vào design system.
