# Prompt thiết kế UI: Nhóm theo ngày trên dòng thời gian training (S42)

> Dán nguyên phần dưới đường kẻ vào công cụ thiết kế có **p-quizzz Design System**, kèm các ảnh hiện trạng trong [S42-assets](S42-assets/) (`1-newest-day-open.png`, `2-all-open.png`, `3-turn-detail.png`, `5-narrow.png`). Business: [PRODUCT.md §7.37](../PRODUCT.md) (và §7.34, §7.35). Spec: [S42-training-multi-day.md](../stories/S42-training-multi-day.md). Thiết kế gốc của màn: [S35-S36-training-ui-prompt.md](S35-S36-training-ui-prompt.md). Code hiện tại: `src/web/features/training-admin/ui/Timeline.tsx`.

---

Thiết kế lại phần **dòng thời gian theo ngày** trên trang "Buổi training AI" của **mentor** trong p-quizzz. Bản hiện tại đã chạy đúng chức năng nhưng **không hài hoà**. Cần một ngôn ngữ thị giác rõ thứ bậc **ngày → phiên Claude Code → prompt**, hợp với phần còn lại của trang. Dùng đúng **p-quizzz Design System**: token màu, typography, spacing, radius, motion, icon Lucide; các component `Button`, `Card`, `Icon`, `Kbd`, `StatusBadge`, `Spinner`, `ErrorMessage`, chip cờ hiện có. Toàn bộ chữ trên UI bằng **tiếng Việt**. Giao diện sáng.

## Bối cảnh
p-quizzz chạy trên máy mentor; học viên dùng Claude Code trong một thư mục bài tập, mọi prompt và lệnh được gửi về máy mentor. Một **buổi training kéo dài nhiều ngày** (cả đợt học) và thu cả ngoài giờ học. Mentor mở trang buổi, chọn một học viên ở cột trái, và đọc **dòng thời gian** của người đó ở cột phải.

- Mỗi **prompt** là một khối có: số thứ tự ("PROMPT 5"), chế độ quyền nếu khác mặc định, số lệnh / số lỗi, nội dung (tối đa 2 dòng), giờ, nút "Xem chi tiết" (mở popup các lệnh) và nút đánh dấu ví dụ.
- Khi member mở phiên Claude Code mới, có một **dải phiên** ("Phiên Claude Code 2 · mở lúc 07:30").

Hành vi đã chốt (PO duyệt, không đổi):
- Dòng thời gian **nhóm theo ngày, ngày mới nhất ở trên**. **Trong một ngày, prompt xếp cũ → mới** để đọc liền mạch.
- Ngày tính theo giờ máy mentor; một lượt thuộc ngày của prompt, kể cả khi lệnh chạy sau 0 giờ.
- **Tiêu đề ngày** gồm nhãn ngày và tóm tắt, ví dụ `Thứ Ba, 24/11/2026` · 5 prompt · 12 lệnh · 2 lỗi; phần lỗi bỏ đi khi bằng 0. Bấm tiêu đề để mở/thu ngày đó.
- Có **từ 2 ngày trở lên** thì mặc định **chỉ mở ngày mới nhất**, các ngày khác thu gọn. Chỉ có 1 ngày thì mở.
- Có thao tác **Mở tất cả / Thu tất cả**.
- Bấm chip cờ, dùng phím J/K, mở chi tiết lượt, hoặc bấm "N sự kiện mới" mà sự kiện nằm trong ngày đang thu gọn → **ngày đó tự mở** rồi cuộn tới.
- Mở trang thì thấy **sự kiện mới nhất**. Sự kiện mới đến khi mentor đang xem chỗ khác → chip nổi **"N sự kiện mới"** ở đáy khung.
- Còn sự kiện mới hơn chưa tải → nút **"Tải thêm"** ở trên cùng, ghi "Còn sự kiện mới hơn chưa tải".
- **Ẩn nội dung** (nút hoặc phím `H`, dùng khi lỡ chiếu màn hình): không hiện prompt, tiêu đề ngày, tóm tắt hay nút mở/thu.

## Vấn đề của bản hiện tại (xem ảnh)
1. **Tiêu đề ngày trông như một prompt**: cùng nền xanh nhạt, viền, bo góc, chiều rộng. Không phân biệt được cấp "ngày" với cấp "prompt".
2. **Nhóm không có ranh giới**: prompt không thụt vào, không có đường hay nền gom nhóm; khoảng cách giữa các ngày gần bằng khoảng cách giữa các prompt. Mở tất cả thì thành một dải thẻ đều nhau.
3. **"Mở tất cả / Thu tất cả" chiếm nguyên một hàng** riêng chỉ để chứa một nút.
4. **Hai kiểu "mốc" khác nhau**: dải phiên Claude Code là đường kẻ mảnh, chữ hoa, căn giữa; tiêu đề ngày là thẻ. Không cùng một ngôn ngữ.
5. **Chữ tiêu đề ngày không có thứ bậc**: nhãn ngày và tóm tắt cùng kiểu chữ xanh đậm, tranh chỗ với nhãn "PROMPT N".
6. Ngày đang thu gọn trông như thẻ bị vô hiệu, và bên dưới để lại khoảng trống lớn.

## Ràng buộc bắt buộc
- **Không phải công cụ chấm điểm**: tóm tắt ngày chỉ là số đếm. Không tô đỏ cả ngày vì có lỗi, không xếp hạng hay so sánh. Số lỗi trình bày trung tính, có thể dùng màu `wrong` nhẹ cho riêng con số.
- **Màn dày dữ liệu**: 20 học viên × vài trăm prompt trong nhiều ngày. Ưu tiên mật độ đọc tốt, ít trang trí. Prompt vẫn là thứ nổi bật nhất trong nội dung một ngày.
- **Thứ bậc rõ**: ngày (cấp 1) > phiên Claude Code (cấp 2, mốc nhẹ bên trong ngày) > prompt (nội dung). Đọc lướt phải thấy ngay ranh giới các ngày, kể cả khi mở tất cả.
- **Trạng thái mở/thu phân biệt ngay**, không chỉ bằng màu: có icon mũi tên, và tiêu đề ngày đang thu vẫn đủ thông tin để mentor quyết định có mở hay không.
- **Thao tác mở/thu tất cả không chiếm một hàng riêng.** Gợi ý: đưa lên hàng thông tin học viên, hoặc gắn vào tiêu đề ngày đầu tiên. Đề xuất cách tốt nhất.
- Có cân nhắc **tiêu đề ngày dính (sticky) ở đầu khung cuộn** khi đọc một ngày dài; quyết định có/không và lý do.
- **Không làm nhảy vị trí đang đọc** khi có sự kiện mới hoặc khi mở/thu một ngày ở trên chỗ đang đọc.
- Trợ năng: tiêu đề ngày là nút (`aria-expanded`), dùng được bằng bàn phím (Enter/Space), có focus ring; tương phản đạt WCAG AA.
- **Khổ màn**: 1440×900 (chính), 1280×800, và khoảng 800px (cột phải hẹp, tiêu đề ngày phải xuống dòng gọn).
- Font, icon có sẵn trong design system (app chạy offline).

## Các trạng thái cần thiết kế
1. **Mặc định nhiều ngày**: hôm nay mở (có dải phiên Claude Code thứ 2 ở giữa ngày), 3 ngày cũ thu gọn.
2. **Mở tất cả**: 4 ngày mở, có một ngày dài phải cuộn (thể hiện tiêu đề dính nếu chọn dùng).
3. **Chỉ một ngày**: không có thao tác mở/thu tất cả; tiêu đề ngày có cần hay không, hay chỉ một nhãn nhẹ? Đề xuất.
4. **Chip cờ vừa mở một ngày đang thu**: prompt căn cứ được tô (kiểu `focus` hiện có).
5. **Có sự kiện mới khi mentor đang đọc ngày cũ**: chip "3 sự kiện mới".
6. **Ngày đang thu có lỗi** (ví dụ 3 lỗi) và có prompt "có thể đang kẹt": tóm tắt trình bày thế nào mà không quy kết.
7. **"Tải thêm"** ở trên cùng.
8. **Ẩn nội dung** (đang bật).
9. **Khổ 800px** của trạng thái 1.
10. Trạng thái **đang tải** và **lỗi tải** của dòng thời gian (hiện có `Spinner`, `ErrorMessage`): chỉ cần kiểm tra vẫn khớp.

## Dữ liệu mẫu
Học viên **Lan**, buổi "Claude Code: viết test", hôm nay Thứ Ba 24/11/2026, bây giờ 10:25.
- **Thứ Ba, 24/11/2026** · 3 prompt · 4 lệnh. Gồm:
  - Phiên Claude Code 1: Prompt 9 (08:40) "đọc lại yêu cầu bài tập và lập kế hoạch".
  - Dải "Phiên Claude Code 2 · mở lúc 09:55".
  - Prompt 10 (10:02) "viết test cho hàm tính tổng giỏ hàng", 2 lệnh.
  - Prompt 11 (10:20) "chạy lại test và sửa lỗi", 1 lệnh lỗi.
- **Thứ Hai, 23/11/2026** · 4 prompt · 9 lệnh · 3 lỗi. Có cờ "Lặp lệnh lỗi": `npm test` lỗi 3 lần liên tiếp. Có một lượt bắt đầu **23:58** với lệnh chạy lúc **00:03** hôm sau; lượt này thuộc ngày 23.
- **Chủ Nhật, 22/11/2026** · 3 prompt · 5 lệnh.
- **Thứ Bảy, 21/11/2026** · 2 prompt · 3 lệnh. Có cờ "Đụng vào test".

## Cần giao
- Frame cho các trạng thái 1–10 ở các khổ đã nêu.
- Spec cho **tiêu đề ngày** (mở / thu / hover / focus / có lỗi), **dải phiên** trong ngày, khoảng cách giữa và trong nhóm, và vị trí thao tác mở/thu tất cả.
- Ghi chú tương tác: mở/thu (có chuyển động hay không, theo `motion` của design system), tiêu đề dính, giữ vị trí đọc khi có sự kiện mới.
- Nếu cần component mới (ví dụ `DayGroupHeader`, `CollapsibleSection`), mô tả props và biến thể để bổ sung vào design system.
- Nếu thấy hành vi đã chốt nào gây khó cho thiết kế (ví dụ "ngày mới nhất ở trên nhưng trong ngày cũ → mới"), nêu rõ để PO cân nhắc. Không tự đổi hành vi.
