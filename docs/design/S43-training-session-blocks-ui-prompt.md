# Prompt thiết kế UI: Khối phiên Claude Code và đánh dấu mới trên dòng thời gian training (S43)

> Dán nguyên phần dưới đường kẻ vào công cụ thiết kế có **p-quizzz Design System**. Đính kèm thiết kế S42 đã duyệt (canvas https://claude.ai/artifact/VweyUbGHM2TvdB3hc1GpSL, bản chép [S42-design/](S42-design/)) và ảnh hiện trạng trong [S42-assets](S42-assets/). Business: [PRODUCT.md §7.38](../PRODUCT.md) (và §7.37). Spec: [S43-training-session-blocks.md](../stories/S43-training-session-blocks.md). Code hiện tại: `src/web/features/training-admin/ui/{Timeline,DayGroupHeader,SessionMarker,MembersTable}.tsx`.

---

Mở rộng thiết kế **dòng thời gian theo ngày** (S42, đã duyệt) trên trang "Buổi training AI" của **mentor** trong p-quizzz. Cần thêm hai thứ:
1. **Khối phiên Claude Code** bên trong mỗi ngày, gom các prompt của cùng một phiên, kể cả khi học viên chạy **nhiều phiên song song**.
2. **Đánh dấu mới**: làm nổi bật prompt mới hoặc prompt có sự kiện mới; tự hết sau khi mentor đã thấy.

Giữ nguyên ngôn ngữ thị giác của S42: tiêu đề ngày, đường ray, `SessionMarker`, chip cờ, chip "N sự kiện mới", tiêu đề dính. Dùng đúng **p-quizzz Design System**: token màu, typography, spacing, radius, motion, icon Lucide; các component `Button`, `Card`, `Icon`, `Kbd`, `StatusBadge`, `Spinner`, `ErrorMessage`. Toàn bộ chữ trên UI bằng **tiếng Việt**. Giao diện sáng.

## Bối cảnh
p-quizzz chạy trên máy mentor. Học viên dùng Claude Code trong một thư mục bài tập; mọi prompt và lệnh được gửi về máy mentor. Một buổi training kéo dài nhiều ngày. Mentor chọn một học viên ở cột trái (danh sách member) và đọc **dòng thời gian** của người đó ở cột phải. Mentor vừa dạy vừa làm việc riêng, nên thường quay lại sau một lúc và cần biết ngay **ai có gì mới, mới ở đâu**.

Học viên hay mở **2–3 cửa sổ Claude Code cùng lúc** (ví dụ một cửa sổ viết code, một cửa sổ viết test). Bản hiện tại chèn dải "Phiên Claude Code N · mở lúc …" mỗi lần sự kiện chuyển từ phiên này sang phiên kia, nên dòng thời gian rời rạc.

## Hành vi đã chốt (PO duyệt, không đổi)
**Từ S42, giữ nguyên:**
- Nhóm theo ngày, ngày mới nhất ở trên; ≥ 2 ngày thì chỉ mở ngày mới nhất; có "Mở tất cả / Thu tất cả" ở hàng thông tin học viên.
- Tiêu đề ngày dính; chip "N sự kiện mới" ở mép phía có sự kiện; "Tải thêm" ở cuối ngày mới nhất; ẩn nội dung (phím `H`).
- Không làm nhảy vị trí đang đọc.

**Khối phiên (mới):**
- Trong mỗi ngày, **mỗi phiên Claude Code là một khối liền**. Trong khối, prompt xếp cũ → mới. Các khối xếp theo giờ bắt đầu trong ngày, cũ → mới.
- Số phiên và số prompt đánh theo cả buổi, nên khi chạy song song, số prompt trong một khối có thể nhảy cách (10, 12, 15). Đây là chủ ý: nó cho thấy có phiên khác chen giữa.
- **Tiêu đề khối** gồm:
  - "Phiên Claude Code N";
  - khoảng giờ trong ngày (09:00–10:15);
  - tóm tắt: số prompt, lệnh, lỗi (bỏ phần lỗi khi bằng 0);
  - cách kết thúc: `/clear`, "thoát", hoặc "chưa kết thúc". "Chưa kết thúc" chỉ có nghĩa là app chưa nhận tín hiệu kết thúc, **không** chắc phiên còn chạy, nên đừng trình bày như "đang chạy, live";
  - "song song với phiên M" khi khoảng giờ chồng lên một khối khác trong ngày.
- Phiên kéo qua 0 giờ: ngày sau có khối riêng ghi "tiếp từ dd/mm".
- Khối **thu/mở được**. Mặc định: khối có mục mới hoặc chưa kết thúc thì mở, còn lại thu.
- Nhảy tới một sự kiện (chip cờ, J/K, "N mới", mở chi tiết) nằm trong khối hoặc ngày đang thu thì cả hai tự mở.

**Đánh dấu mới (mới):**
- Prompt **mới**, hoặc prompt cũ **có sự kiện mới** (lệnh mới, xin quyền mới…), được làm nổi bật. **Không chỉ bằng màu**: cần thêm chữ, nhãn hoặc icon.
- Hết nổi bật khi prompt nằm trong khung nhìn **khoảng 2 giây liền** (tab đang hiện, nội dung không ẩn).
- Có nút **"Đánh dấu đã đọc hết"** cho học viên đang xem.
- Ngày hoặc khối phiên **đang thu** hiện "N mới".
- **Danh sách member** hiện số prompt mới chưa đọc cạnh tên.
- Chip "N sự kiện mới" (S42) đếm theo **số prompt có mục mới**, không theo số sự kiện.
- Lần đầu mở buổi trên một trình duyệt: không có gì nổi bật, chỉ những gì tới sau mới nổi bật.
- Chỉ mentor thấy. Không phải cờ, không phải điểm.

## Ràng buộc bắt buộc
- **Thứ bậc rõ**: ngày (cấp 1) > khối phiên (cấp 2) > prompt (nội dung). Khối phiên phải nhẹ hơn tiêu đề ngày rõ rệt, nhưng đủ để thấy ranh giới giữa hai phiên, kể cả khi mở hết.
- **Màn dày dữ liệu**: 20 học viên × vài trăm prompt × nhiều ngày; có học viên `/clear` liên tục nên **một ngày có thể có 10+ phiên, nhiều phiên chỉ 1–2 prompt**. Khối ngắn phải gọn, không tốn chỗ hơn chính prompt bên trong.
- **Song song** phải đọc được ngay mà không cần bản làn song song: gợi ý dùng nhãn hoặc chỉ dấu nhỏ. Đề xuất cách tốt nhất.
- **Đánh dấu mới** phải dễ thấy khi lướt nhưng không chói, không lẫn với:
  - kiểu `focus` (nền vàng nhạt khi nhảy tới sự kiện);
  - chip cờ;
  - màu lỗi `wrong`;
  - prompt được đánh dấu "ví dụ".
  Khi một prompt vừa mới vừa có cờ hay vừa là ví dụ thì cả hai cùng đọc được. Hết nổi bật nên có chuyển động nhẹ (nếu có), tôn trọng giảm chuyển động.
- Không quy kết: số lỗi, "chưa kết thúc", "song song" đều trình bày trung tính.
- **Trợ năng**: tiêu đề khối là nút (`aria-expanded`), dùng được bằng bàn phím, có focus ring; trạng thái "mới" có chữ cho trình đọc màn hình; tương phản đạt WCAG AA.
- **Khổ màn**: 1440×900 (chính), 1280×800, và khoảng 800px (cột phải hẹp).
- Font, icon có sẵn trong design system (app chạy offline).

## Các trạng thái cần thiết kế
1. **Hôm nay, 3 phiên, có 2 phiên song song**: phiên 2 (đã `/clear`) thu; phiên 3 và 4 song song, mở; vài prompt mới nổi bật.
2. **Mở tất cả**: ngày cũ có nhiều phiên ngắn (thêm dữ liệu giả nếu cần để có 6+ phiên 1–2 prompt). Kiểm mật độ.
3. **Ngày chỉ có một phiên**: biến thể nhẹ (có cần tiêu đề khối không?).
4. **Khối đang thu có mục mới**: "N mới" trên tiêu đề khối; và ngày đang thu có mục mới: "N mới" trên tiêu đề ngày, cạnh chip cờ của ngày.
5. **Prompt cũ có sự kiện mới**: một lệnh vừa chạy thêm dưới prompt đã đọc. Thể hiện chỗ nào là mới.
6. **Đang đếm 2 giây → hết nổi bật**: trạng thái trước và sau.
7. **Danh sách member** có số mới cạnh tên (vài người có, vài người không; một người đang được chọn; một người "có thể đang kẹt"). Không để số mới trông như điểm hay cảnh báo.
8. **"Đánh dấu đã đọc hết"** ở hàng thông tin học viên, cạnh "Mở tất cả / Thu tất cả".
9. **Chip "N sự kiện mới"** với chữ mới (đếm theo prompt).
10. **Phiên kéo qua 0 giờ**: khối "tiếp từ 23/11" ở đầu ngày 24, khối ngày 23 ghi gì ở cuối.
11. **Chip cờ vừa mở một khối đang thu** trong một ngày đang thu: prompt căn cứ được tô (kiểu `focus` hiện có).
12. **Ẩn nội dung** đang bật (không lộ gì, kể cả số mới trong dòng thời gian).
13. **Khổ 800px** của trạng thái 1 và 7.

## Dữ liệu mẫu
Học viên **Lan**, buổi "Claude Code: viết test". Hôm nay là Thứ Ba 24/11/2026, bây giờ 10:25.
- **Thứ Ba, 24/11/2026** · 7 prompt · 11 lệnh · 1 lỗi
  - **Phiên Claude Code 5** · tiếp từ 23/11 · 00:00–00:20 · 1 prompt · 1 lệnh · thoát. Gồm Prompt 14 (00:12) "commit phần đã xong".
  - **Phiên Claude Code 6** · 08:40–09:05 · 2 prompt · 2 lệnh · `/clear`. Gồm Prompt 15 "đọc lại yêu cầu bài tập và lập kế hoạch" và Prompt 16.
  - **Phiên Claude Code 7** · 09:55–10:24 · song song với phiên 8 · 2 prompt · 5 lệnh · 1 lỗi · chưa kết thúc. Gồm Prompt 17 (09:55) "viết hàm tính tổng giỏ hàng" và Prompt 19 (10:20) "sửa lỗi làm tròn" (**mới**, có 1 lệnh lỗi).
  - **Phiên Claude Code 8** · 10:01–10:22 · song song với phiên 7 · 2 prompt · 3 lệnh · chưa kết thúc. Gồm Prompt 18 (10:01) "viết test cho hàm tính tổng giỏ hàng" (đã đọc, nhưng **có 1 lệnh mới** `npm test` ✓ lúc 10:22) và Prompt 20 (10:22) "thêm test số âm" (**mới**).
- **Thứ Hai, 23/11/2026** · 10 prompt · 14 lệnh · 3 lỗi · đang thu · **2 mới**. Có cờ "Lặp lệnh lỗi" (`npm test` lỗi 3 lần liên tiếp trong phiên 3). Gồm phiên 2, 3, 4 (ngắn, mỗi phiên 2–3 prompt, đều kết thúc bằng `/clear`) và phiên 5 bắt đầu 23:50 (Prompt 13), kéo sang hôm sau.
- **Chủ Nhật, 22/11/2026** · 3 prompt · 5 lệnh · đang thu. Một phiên (phiên 1), dùng cho trạng thái 3.

Danh sách member: Lan (đang chọn, 2 mới), Minh (5 mới, có thể đang kẹt), Hoa (0), Tuấn (1 mới, đã dừng gửi), An (0, chưa nhận tín hiệu).

## Cần giao
- Frame cho các trạng thái 1–13 ở các khổ đã nêu.
- Spec cho:
  - **tiêu đề khối phiên** (mở / thu / hover / focus / có mục mới / song song / chưa kết thúc / tiếp từ);
  - **kiểu nổi bật "mới"** trên prompt và trên sự kiện mới trong prompt cũ, kèm chuyển động khi hết;
  - **số mới** ở danh sách member, tiêu đề ngày, tiêu đề khối;
  - khoảng cách giữa và trong khối, cách khối nằm trên đường ray của ngày.
- Ghi chú tương tác: mở/thu khối (có chuyển động hay không), khối có dính không (S42 chỉ cho tiêu đề ngày dính), giữ vị trí đọc khi một khối phía trên mở/thu hoặc có sự kiện mới.
- Nếu cần component mới (ví dụ `SessionBlockHeader`, `NewBadge`), mô tả props và biến thể.
- Nếu thấy hành vi đã chốt nào gây khó cho thiết kế (ví dụ mặc định mở/thu khối, ngưỡng 2 giây, chip đếm theo prompt), nêu rõ để PO cân nhắc. Không tự đổi hành vi.
