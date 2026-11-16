# S05 — UI import & quản lý đề

**Phụ thuộc:** S04 · **Song song với:** S08

## Bối cảnh
Bước cuối của quy trình soạn đề ([PRODUCT.md §6](../PRODUCT.md)): mentor đưa file vào app, xem trước, xác nhận.

## Phạm vi
- `/admin/exams/import`: chọn file `.md` **hoặc** kéo thả **hoặc** dán nội dung. Gọi `preview` (debounce khi dán).
  - Có lỗi: danh sách lỗi + cảnh báo theo số dòng; hiển thị nội dung kèm số dòng, dòng lỗi tô đỏ, bấm vào lỗi cuộn tới dòng. Nút Import bị khoá.
  - Không lỗi: tóm tắt (số câu theo loại, tổng điểm, "có tự luận → làm 1 lần" / "cho làm lại"), cảnh báo (nếu có), và **preview từng câu như member sẽ thấy** kèm đánh dấu đáp án đúng + giải thích (dùng `<Markdown>`). Nút Import → tạo → chuyển tới chi tiết đề. Nút bị khoá khi đang gửi (chống tạo trùng do bấm hai lần; xem PRODUCT.md §7.10).
- `/admin/exams`: bảng danh sách đề (tên, số câu, tổng điểm, loại, số phiên đã dùng, ngày tạo), nút xoá (xác nhận; ẩn/khóa khi đã có phiên), nút "Mở phiên thi" (link tới tạo phiên — S09 sẽ nối; tạm điều hướng `/admin/sessions?examId=`).
- `/admin/exams/:id`: xem đầy đủ đề như preview.
- Component preview câu hỏi đặt ở `src/web/shared/ui/QuestionPreview.tsx` (_ban đầu `components/`_) để S16 tái dùng.

## Acceptance criteria
- [x] Import file mẫu `exams/examples/git-co-ban.md` thành công bằng cả 3 cách đưa nội dung vào.
- [x] File lỗi: thấy đúng số dòng, bấm lỗi nhảy tới dòng, không import được.
- [x] Code block trong câu hỏi hiển thị có highlight.
- [x] Bấm Import nhiều lần liên tiếp chỉ tạo đúng 1 đề (nút khoá khi đang gửi).

## Test bắt buộc
- Không bắt buộc test UI tự động; ghi rõ các luồng đã thao tác tay trong báo cáo.
