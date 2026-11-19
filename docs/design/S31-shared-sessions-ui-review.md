# Nhận xét bản thiết kế — Trang chia sẻ các phiên đã thi (S31)

> Bản thiết kế: [canvas trên claude.ai](https://claude.ai/artifact/J7ywAkWqG1fHeDc4Vv9t6K) (riêng tư của mentor). Prompt: [S31-shared-sessions-ui-prompt.md](S31-shared-sessions-ui-prompt.md). Story: [S31](../stories/S31-shared-sessions.md). Business: [PRODUCT.md §7.33](../PRODUCT.md).

## Kết luận
Dùng được để code. Đủ 13 trạng thái của prompt, có laptop 1440×900 và điện thoại 390×844; không chỗ nào hiện tên, điểm hay bài làm của người khác.

## Quyết định của designer (giữ)
- **Chi tiết phiên = một trang cuộn + mục lục.** Laptop: `QuestionNav` dính cột trái, sáng theo câu đang đọc. Điện thoại: nút "Câu x/20" ở thanh đầu mở sheet có `QuestionNav`.
- **Tỉ lệ chọn hiện cả % và số người**, mẫu số là số bài nộp (ghi dưới mỗi câu); câu nhiều đáp án ghi rõ tổng có thể > 100%; bỏ trống là dòng riêng.
- **Hàng "Link chia sẻ"** (≈56px) ngay trên bảng Lịch sử phiên ở trang Phiên thi: link, Sao chép ("Đã sao chép" 2 giây, `aria-live`), Đổi link + xác nhận.
- **Dòng phiên** nhận diện bằng khối ngày | giờ ở cột đầu, nhóm theo tháng.
- Quay lại danh sách giữ vị trí cuộn; link chi tiết mở trực tiếp được; `#cau-<n>` nhảy tới câu.
- Link sai và link đã đổi dùng **cùng một màn** ("Link này không mở được"); id phiên sai rơi vào màn "Phiên này không còn được chia sẻ".

## Lệch spec và cách xử lý
| Thiết kế | Spec | Quyết định |
|---|---|---|
| URL `/xem-lai/:token` | `/shared/:token` | Giữ `/shared` (khớp route hiện có). |
| Cảnh báo mạnh có ô "Tôi hiểu…" phải tick | Chỉ cảnh báo | Nhận: học viên của phiên đang thi cùng đề có thể mở link thấy đáp án. Đã ghi vào PRODUCT.md §7.33a. |
| Nút "Xem như người xem" | Không có | Nhận (mở link chia sẻ). |

## Phản biện của designer và quyết định của PO (2026-11-19)
1. **Ngưỡng ẩn tỉ lệ** (prompt: < 3 bài nộp thì ẩn; designer đề xuất 5). PO chọn **không có ngưỡng**, thay bằng dòng cảnh báo trong hộp xác nhận khi phiên **dưới 5 bài nộp**. Màn B6 ("ít bài nộp") vì vậy chỉ còn dùng cho phiên **0 bài nộp**, chữ đổi thành "Phiên không có bài nộp nào nên không có tỉ lệ chọn". Hộp xác nhận C10 thêm biến thể cảnh báo ít bài nộp, dùng `ErrorMessage tone="warning"` như cảnh báo mạnh, không cần thiết kế lại.
2. **Dấu "Đã lộ đáp án" ở trang Đề thi**: PO quyết **không làm**. Chia sẻ chỉ chọn theo phiên, không chọn từng câu.
3. `ReviewQuestions` có trong code nhưng gắn với bài làm của một người, `AnswerOption` mang nghĩa "bạn đã chọn/bỏ sót": đều không dùng. Dùng component mới **`ClassTally`** của designer; phần đề và giải thích dùng lại `QuestionPreview`.
4. `Button` thêm prop `href` để nút điều hướng là link thật.
