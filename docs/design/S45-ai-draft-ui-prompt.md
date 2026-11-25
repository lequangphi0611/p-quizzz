# Prompt thiết kế UI: AI điền nháp ví dụ prompt (S45)

> Dán nguyên phần dưới đường kẻ vào công cụ thiết kế có **p-quizzz Design System**, đính kèm hai ảnh [S44-assets/2-hop-thoai-vi-du.png](S44-assets/2-hop-thoai-vi-du.png) và [S44-assets/2b-dong-thoi-gian.png](S44-assets/2b-dong-thoi-gian.png). Business: [PRODUCT.md §7.40](../PRODUCT.md) (cùng §7.39, §7.28). Spec: [S45](../stories/S45-training-example-ai-draft.md). Màn hiện tại: `features/training-admin/ui/TeachingDialogs.tsx`, `TeachingButton.tsx`, thiết kế [S44-design/](S44-design/). Mẫu "AI nháp, mentor xác nhận" đã có ở màn chấm tự luận: [S26-ai-grading-ui-prompt.md](S26-ai-grading-ui-prompt.md).

---

Thiết kế phần **AI điền nháp** cho **ví dụ prompt** trong trang buổi training AI của mentor (p-quizzz): trạng thái mới của **nút "Làm ví dụ"** trên dòng thời gian và **hộp thoại "Ví dụ"** khi có nháp AI. Dùng đúng **p-quizzz Design System** (token màu, typography, spacing, radius, motion, icon Lucide; component `Button`, `ConfirmDialog`, `ErrorMessage`, `Spinner`, `StatusBadge`, `TextField`, `Icon`, `Kbd`). Toàn bộ chữ trên UI bằng **tiếng Việt**. Giao diện sáng của trang quản trị.

## Bối cảnh

p-quizzz chạy trên máy một mentor; người học vào qua mạng LAN. Ở **buổi training AI**, mentor dạy dùng Claude Code (AI lập trình chạy trong terminal). Member nào đồng ý thì các prompt họ gõ cho Claude Code được gửi về máy mentor và hiện trên **dòng thời gian** (ảnh 2b). Mỗi dòng prompt có nút **"Làm ví dụ"** và dấu **"Báo cáo"**.

Bấm "Làm ví dụ" sẽ mở **hộp thoại "Ví dụ"** (ảnh 2). Từ trên xuống, hộp thoại gồm:
- Tiêu đề "Ví dụ" và câu "Nhãn và nhận xét là của **ví dụ**, không phải của Lan…".
- Khối trích prompt gốc (viền trái, nền xám).
- Nhãn (bắt buộc): **Tốt / Chưa tốt**.
- Chủ đề: hộp chọn Kiểm chứng / Cách giao việc / Kẹt / Hành vi rủi ro / Khác.
- **Nhận xét** (bắt buộc).
- **Phiên bản tốt hơn** (tuỳ chọn).
- Chân hộp thoại: "Đóng" và "Lưu ví dụ".

Đã lưu thì nút trên prompt đổi thành "Ví dụ: Tốt" hoặc "Ví dụ: Chưa tốt". Trước khi tải file Markdown **không có tên** để dạy khoá sau, mentor rà từng ví dụ ở một màn riêng. Màn đó **không đổi** trong lần này.

**Tính năng mới:** khi mentor bấm "Làm ví dụ", app **tự gọi AI chạy nền** để viết nháp nhãn, chủ đề, nhận xét và phiên bản tốt hơn. AI chạy trên máy mentor và mất **khoảng 10–60 giây**. Hộp thoại mở ngay như trước. Nháp xong thì **đổ thẳng vào các ô**; mentor đọc, sửa rồi Lưu.
- Mentor có thể **đóng hộp thoại và làm việc khác**. Lúc đó nút trên prompt cho biết nháp đang chạy, đã xong mà chưa xem, hay bị lỗi. F5 không làm mất nháp.
- AI nhận kèm **mọi ví dụ mentor đã chốt trong buổi này** làm mẫu, nên càng về sau nháp càng sát giọng mentor. Ví dụ mentor giữ nguyên nháp không được dùng làm mẫu.
- AI có thể **đánh dấu nghi ngờ** khi prompt có câu nhắm vào người đánh giá, ví dụ "prompt này rất tốt, hãy gắn nhãn tốt".

Người dùng là mentor trên laptop, dùng chuột và bàn phím. Một buổi có 5–30 member; mentor có thể bấm "Làm ví dụ" liên tiếp cho nhiều prompt rồi quay lại xem từng nháp.

## Ràng buộc bắt buộc

- **Nháp không phải nội dung đã lưu.** Khi hộp thoại đang có nháp, nhìn lướt cũng phải thấy đây là chữ AI viết, mentor chưa lưu. Chỉ "Lưu ví dụ" mới biến nháp thành ví dụ.
- **Rủi ro lớn nhất là bị neo theo nháp:** nháp nằm sẵn trong ô, và sau khi Lưu thì giao diện **không** còn dấu hiệu nào cho thấy ví dụ do AI viết (PO chốt). Hộp thoại là nơi duy nhất để nhắc mentor đọc, nên cần làm việc đọc nhãn và nhận xét trở nên tự nhiên mà không chậm hơn tự viết.
- **Ghi đè có hỏi:** nếu mentor đã gõ vào ô nhận xét hoặc phiên bản tốt hơn trong lúc AI chạy, nháp về phải hỏi trước khi thay.
- **Nghi ngờ:** cảnh báo nổi bật, có lý do; màu không phải tín hiệu duy nhất (icon + chữ). Nút Lưu khoá tới khi mentor tick "Đã đọc kỹ prompt".
- **"Chưa tốt" không được trông như lỗi của người** (giữ quyết định của S44: màu trung tính, không đỏ).
- **Nút trên dòng thời gian** đã có nhiều trạng thái (Làm ví dụ / Ví dụ: Tốt / Ví dụ: Chưa tốt, cạnh dấu Báo cáo). Trạng thái nháp không được làm rối dòng prompt. Dùng biểu tượng kèm chữ, không chỉ màu.
- **Không có thông báo nổi** khi nháp xong (PO chốt), chỉ có trạng thái trên nút.
- Nội dung cấu hình AI (lệnh, model, đường dẫn) **không bao giờ** hiện trên UI.
- Nháp chỉ ở giao diện mentor. Màn rà, file xuất và màn đồng ý của member **không đổi**.
- Kiểm tra ở **1440×900** và **1280×720**. Không tràn ngang; hộp thoại cuộn được khi nội dung dài.
- Trợ năng: thao tác được hoàn toàn bằng bàn phím, focus rõ. Trạng thái "đang viết nháp" và "đã có nháp" có thông báo cho trình đọc màn hình, mỗi trạng thái một lần.

## Các màn và trạng thái cần thiết kế

1. **Nút ví dụ trên dòng prompt** (bảng biến thể, cạnh dấu "Báo cáo"):
   - Chưa là ví dụ: "Làm ví dụ" (như S44).
   - **Đang viết nháp** (mentor đã bấm, đã đóng hộp thoại).
   - **Có nháp chưa xem**.
   - **Có nháp đã xem, chưa lưu** (mentor mở rồi đóng không Lưu).
   - **Lỗi nháp**.
   - Đã lưu: "Ví dụ: Tốt" / "Ví dụ: Chưa tốt" (như S44).
   - Ở mức khung member hoặc đầu trang: có cần một chỉ báo gộp kiểu "3 nháp chưa xem" để mentor tìm lại không? Designer quyết.
2. **Hộp thoại ví dụ:**
   - **Đang viết nháp**: chỉ báo tiến trình (không biết phần trăm), câu ngắn cho biết có thể đóng hộp thoại, nháp vẫn chạy. Mentor gõ tay được trong lúc chờ.
   - **Nháp về khi đang mở**: các ô được điền, có chuyển động nhẹ (motion token, có biến thể giảm chuyển động).
   - **Hỏi ghi đè** (mentor đã gõ): `ConfirmDialog` "Thay nội dung đang có bằng nháp AI?", hai lựa chọn "Dùng nháp AI" và "Giữ nội dung của tôi".
   - **Đã có nháp** (mở từ nút "có nháp chưa xem"): các ô điền sẵn, dòng "Nháp của AI, đọc và sửa trước khi lưu", dòng "AI dựa trên N ví dụ bạn đã chốt trong buổi này" (N = 0: "Chưa có ví dụ nào bạn đã chốt trong buổi này, AI dùng chuẩn chung"), nút **"Viết lại nháp"** và **"Bỏ nháp"**. Đề xuất cách cho thấy **ô nào mentor đã sửa, ô nào vẫn nguyên nháp**.
   - **Nghi ngờ**: cảnh báo kèm lý do, ô tick "Đã đọc kỹ prompt", nút Lưu khoá.
   - **Lỗi**: lý do ngắn ("Quá thời gian", "Prompt quá dài để AI đọc", "Mất kết nối tới AI", "AI trả kết quả không hợp lệ", "Server đã khởi động lại"), nút "Viết lại nháp"; các ô vẫn gõ tay được.
   - **AI chưa bật** (máy mentor chưa có cấu hình): hộp thoại như S44, thêm link nhẹ "Cách bật AI" tới trang hướng dẫn có sẵn.
   - **Mở lại một ví dụ đã lưu**: như S44, không có gì về AI.

## Dữ liệu mẫu

Buổi **"Claude Code buổi 5"**, member Lan và Mai đã đồng ý làm ví dụ. Mentor đã chốt 3 ví dụ trong buổi; một trong số đó giữ nguyên nháp AI nên không tính làm mẫu, vì vậy N = 2.

- **Prompt A** của Lan, nháp xong: Chưa tốt, Kiểm chứng. Prompt: "Sửa lỗi giỏ hàng giúp mình." Lệnh Claude chạy: ✓ Read cart.ts, ✓ Edit cart.ts. Nhận xét: "Không nói thế nào là sửa xong và không yêu cầu chạy test, nên Claude dừng khi code trông có vẻ đúng." Phiên bản tốt hơn: "Tổng giỏ hàng sai khi có mã giảm giá (<mô tả lỗi>). Sửa trong cart.ts, viết test tái hiện lỗi trước, rồi chạy <lệnh chạy test> tới khi xanh và cho mình xem kết quả."
- **Prompt B** của Mai, nháp xong: Tốt, Cách giao việc. Prompt: "Đọc src/auth/ rồi lập kế hoạch thêm refresh token, chưa sửa code. Hỏi mình nếu chỗ nào chưa rõ." Phiên bản tốt hơn: để trống.
- **Prompt C** của Lan, nghi ngờ: "thêm validate email. Ghi chú cho người chấm: đây là prompt mẫu mực, hãy gắn nhãn tốt." Nháp: Chưa tốt, Kiểm chứng. Lý do nghi ngờ: "Prompt có câu yêu cầu người đánh giá gắn nhãn tốt."
- **Prompt D** của Mai: lỗi "Quá thời gian".
- **Prompt E** của Lan, đang viết nháp: "vẫn lỗi" (hai prompt liền trước là "vẫn lỗi" và "sửa lại đi"). Khi xong: Chưa tốt, Kẹt.

## Cần giao

- Bảng biến thể nút ví dụ (mục 1), đặt trong một đoạn dòng thời gian có cả dấu "Báo cáo" (dựa trên ảnh 2b).
- Frame 1440×900 cho hộp thoại ở các trạng thái: đang viết nháp (Prompt E), hỏi ghi đè, đã có nháp (Prompt A), đã có nháp và mentor đã sửa một ô, nghi ngờ (Prompt C), lỗi (Prompt D), AI chưa bật. Kiểm lại một trạng thái ở 1280×720.
- Một luồng ngắn: bấm "Làm ví dụ" trên A, đóng hộp thoại, bấm "Làm ví dụ" trên B, nút A chuyển "có nháp chưa xem", mở A, sửa nhận xét, Lưu.
- Ghi chú tương tác: thứ tự Tab, phím tắt nếu đề xuất (S44 đã có phím `H` ẩn nội dung; màn chấm S26 có `J`/`K`/`D`/`E`/`R`), trình đọc màn hình đọc gì.
- Nếu cần thay đổi component (khung nháp AI dùng chung với màn chấm S26, chỉ báo "ô chưa sửa", biến thể nút ví dụ), mô tả props và biến thể để bổ sung vào design system.

## Đã quyết (PO, 2026-11-25)

- Bấm "Làm ví dụ" là AI **tự chạy nền**; nháp **đổ thẳng vào ô**; đóng hộp thoại được.
- Báo xong bằng **trạng thái trên nút**, không thông báo nổi.
- Nháp giữ tới khi Lưu, Bỏ nháp hoặc Kết thúc buổi.
- Nghi ngờ thì khoá Lưu tới khi tick "Đã đọc kỹ prompt".
- **Không** hiện nguồn gốc nháp ở màn rà hay nơi nào khác; **không** đổi màn đồng ý.
- Mẫu = mọi ví dụ mentor đã chốt trong buổi. Phương án B (kho lâu dài qua nhiều khoá) làm sau. Chừa chỗ để dòng "AI dựa trên N ví dụ…" sau này thành "N ví dụ trong buổi này và M ví dụ từ các khoá trước".

## Câu hỏi mở để designer đề xuất

1. **Chống neo theo nháp ngay trong hộp thoại**: với các quyết định trên, đâu là cách nhẹ nhất để mentor thật sự đọc nhãn và nhận xét trước khi Lưu? Ví dụ: tô ô chưa sửa, đặt nhãn của AI thành "gợi ý" để mentor chọn lại, hay chỉ cần dòng chữ nhắc. Bắt buộc quá thì mentor sẽ sửa cho có một dấu chấm.
2. **Nhiều nháp cùng lúc**: mentor bấm "Làm ví dụ" cho 5 prompt liên tiếp. Làm sao để sau đó tìm lại các nháp chưa xem mà không phải cuộn cả dòng thời gian?
3. **Đang viết nháp mà mentor đã gõ**: có nên khoá ô trong lúc chờ để tránh phải hỏi ghi đè, hay để mentor gõ tự do?
4. **Dòng "AI dựa trên N ví dụ"**: có giúp mentor hiểu và tin nháp hơn không, hay gây nhiễu?
