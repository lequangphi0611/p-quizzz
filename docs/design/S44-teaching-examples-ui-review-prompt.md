# Prompt cho designer: rà UI "Ví dụ dạy lớp sau" (S44)

> Bối cảnh: PO chọn làm trước bằng component có sẵn rồi nhờ designer rà trên màn thật (2026-11-25). Business: [PRODUCT.md §7.39](../PRODUCT.md). Spec: [S44](../stories/S44-training-teaching-examples.md). Ảnh chụp: [S44-assets/](S44-assets/). Dùng p-quizzz Design System; component trong code ở `src/web/shared/ui` là nguồn đúng nếu design system thiếu.

## Tính năng trong một đoạn

Trong buổi training AI (dạy dùng Claude Code), mentor chọn prompt thật của member, gắn nhãn **Tốt / Chưa tốt**, chủ đề, nhận xét và "phiên bản tốt hơn", rồi xuất một file Markdown **không có tên** để dạy khoá sau. Member phải tick đồng ý riêng (mặc định không tick). Trước khi tải, mentor **rà và sửa** từng ví dụ để bỏ chi tiết nhận ra người viết. Bước rà là lớp bảo vệ chính cho việc giấu tên: app chỉ tự bỏ tên, ngày giờ và che chuỗi giống khoá.

## Màn cần rà

| Ảnh | Màn | Ai dùng | Thiết bị |
|---|---|---|---|
| `1-man-dong-y.png` | Màn đồng ý của member, có ô tick mới | Member | Laptop **và điện thoại** |
| `2-hop-thoai-vi-du.png` | Hộp thoại tạo / sửa ví dụ | Mentor | Laptop |
| `3-nut-khoa.png` | Dòng prompt của member không đồng ý (nút khoá) | Mentor | Laptop |
| `4-man-ra-soat.png` | Màn rà trước khi xuất | Mentor | Laptop |

## Câu hỏi chính

1. **Màn rà có giúp rà kỹ thật không, hay dễ tick cho xong?** Hiện tại chỉ có một ô tick "Tôi đã rà…" ở cuối. Với 15–20 ví dụ thì danh sách rất dài. Có nên tick "đã rà" theo từng ví dụ, có thanh tiến độ "đã rà 7/20", làm nổi chỗ app đã tự che, hay làm nổi các từ viết hoa hoặc tên riêng để gợi ý chỗ cần xem?
2. **Phân biệt bản gốc với bản đã sửa**: mentor có cần thấy hai bản cạnh nhau không? Nút "Về bản gốc" và chữ "Đã lưu bản sửa" có đủ rõ không?
3. **Nút khoá trên từng prompt** (`3-nut-khoa.png`): member mới mặc định không tick, nên phần lớn prompt sẽ có nút khoá viền đứt "Không dùng làm ví dụ". Có rối không? Phương án khác: chỉ hiện một dòng trạng thái ở đầu dòng thời gian của member đó, và ẩn nút trên từng prompt.
4. **Hàng nút đầu trang** giờ có 3 nút xuất cộng "Dừng thu". Có nên gộp 3 nút xuất vào một menu "Xuất…" không? Ba loại xuất khác nhau về mức nhạy cảm: báo cáo có tên, zip thô có output, ví dụ không tên. Mentor cần phân biệt được.
5. **Hộp thoại ví dụ** (`2-hop-thoai-vi-du.png`): prompt gốc hiện ở đầu hộp thoại **chưa che** (mentor vốn thấy bản gốc trên dòng thời gian). Có nên nhắc ngay ở đây rằng "bản trong file sẽ được che và bạn rà ở bước xuất" không? Nhãn Tốt / Chưa tốt hiện là nút chọn hai trạng thái, có cần màu không, và màu có làm "Chưa tốt" trông như lỗi của người không?
6. **Màn đồng ý trên điện thoại**: ô tick mới kèm 4 câu giải thích (không bắt buộc; có thể bị gắn "chưa tốt" kèm nhận xét; mentor biết ai tick; dừng gửi không rút lại; file đã xuất không thu hồi được). Có quá dài không, có làm member thấy bị ép không? Ô tick phải tách rõ khỏi ô "Đồng ý" bắt buộc của buổi.

## Trạng thái cần thiết kế hoặc kiểm

- Màn rà: chưa có ví dụ nào; đang tải; lỗi lưu bản sửa; **Ẩn nội dung** bật (phím H: không hiện nội dung, không cho tải); rất nhiều ví dụ.
- Hộp thoại ví dụ: tạo mới, sửa, bỏ ví dụ (xác nhận), lỗi lưu, member đã dừng gửi.
- Nút trên dòng prompt: chưa là ví dụ, đã là ví dụ "Tốt" hoặc "Chưa tốt" (biểu tượng + chữ, không chỉ màu), khoá.

## Ràng buộc

- Offline: không font hay ảnh từ CDN.
- Chữ trên giao diện bằng tiếng Việt. Nhãn và nhận xét nói về **ví dụ**, không nói về người (§7.34a).
- Không thêm nơi nào hiển thị nhãn cho member, màn hình chiếu hay báo cáo có tên.

## Kết quả mong muốn

Nhận xét theo từng câu hỏi ở trên, kèm mockup cho những chỗ đề xuất đổi. Đánh dấu rõ chỗ nào **nên sửa trước khi dùng thật** và chỗ nào để sau.
