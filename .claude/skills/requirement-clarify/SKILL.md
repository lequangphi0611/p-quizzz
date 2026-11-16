---
name: requirement-clarify
description: Làm rõ một yêu cầu/ý tưởng tính năng còn mơ hồ cho p-quizzz trước khi thiết kế hay code. Kiểm tra yêu cầu có hợp lý và không mâu thuẫn với docs/PRODUCT.md, phân tích giá trị cho từng actor (mentor, member, màn hình chiếu), đóng vai từng actor để tìm kịch bản và xung đột, rồi trả báo cáo cho PO duyệt. Dừng ở báo cáo, KHÔNG sửa docs, KHÔNG viết code. Trigger: "thêm tính năng ...", "là một mentor ...", "là 1 học viên ...", "là một member ...", "tôi muốn ...", "có nên làm ...", làm rõ yêu cầu, ý tưởng mới.
---

# Làm rõ yêu cầu (requirement-clarify)

Mục tiêu: biến một yêu cầu mơ hồ thành **báo cáo cho PO (người dùng) quyết định**: có nên làm không, làm theo hướng nào, đánh đổi gì. Skill kết thúc khi báo cáo được trả trong chat; chờ PO duyệt. Việc sửa `docs/PRODUCT.md`, tạo story hay code chỉ làm khi PO duyệt, bằng yêu cầu riêng.

Quy ước thuật ngữ: PO nói "học viên" = **Member** trong `PRODUCT.md`. Dùng "Member" trong báo cáo.

Tinh thần: đồng sáng lập, không phải người nhận lệnh. Nếu yêu cầu bất hợp lý thì nói thẳng và nêu lý do trước. Không biết thì ghi "chưa đủ thông tin"; không bịa số liệu.

## Bước 0. Nạp bối cảnh (bắt buộc)

Đọc `docs/PRODUCT.md`, đặc biệt: §1 thước đo thành công, §2 actors, §4 luồng và luật (1 lượt/phiên, vòng đời phiên, chấm điểm), §5 phạm vi (MVP / phase 2 / ngoài phạm vi), §7 vấn đề mở. Chỉ đọc `docs/architecture.md` và `docs/stories/` khi cần ước lượng độ chạm ở bước 6.

Không đánh giá từ trí nhớ. Mọi nhận định về "mâu thuẫn" phải trích được mục trong `PRODUCT.md`.

## Bước 1. Phân loại và diễn đạt lại

1. Viết lại yêu cầu trong 1–2 câu; liệt kê chỗ còn mơ hồ.
2. Chọn mức:
   - **Nhẹ**: yêu cầu nhỏ, chỉ chạm một actor, không đụng luật nghiệp vụ. Làm bước 2–4 và 7, không dùng subagent.
   - **Đầy đủ**: chạm ≥ 2 actor, đụng luật trong `PRODUCT.md`, hoặc thêm khái niệm mới. Làm đủ các bước.
3. Nếu thiếu thông tin **chặn** việc đánh giá (mục tiêu, actor hưởng lợi, bối cảnh dùng), hỏi PO **một lần, gộp** rồi mới đi tiếp. Thiếu thông tin không chặn thì nêu thành giả định trong báo cáo, không hỏi.

## Bước 2. Kiểm tra phù hợp

- Mâu thuẫn với luật hiện có không (trích mục)? Ví dụ: 1 lượt/phiên, đáp án chỉ lộ từ `CLOSED`, member không có tài khoản.
- Thuộc MVP, phase 2 hay ngoài phạm vi (§5)? Có trùng hoặc đang là vấn đề mở (§7) không?
- Có đi ngược mục tiêu "ôn luyện vui, không phải thi có hệ quả" (§1) không?

## Bước 3. Giá trị

Giá trị cho từng actor (Mentor, Member, Màn hình chiếu): giải quyết nỗi đau nào, gắn với thước đo thành công nào (§1). Nếu không gắn được với giá trị cụ thể cho actor nào, nói rõ và đặt câu hỏi "có nên làm không".

## Bước 4. Mở rộng góc nhìn

Business: cách khác đạt cùng mục tiêu rẻ hơn; ảnh hưởng quy trình của mentor; có làm member bớt vui không.
Non-business (theo ràng buộc của app): offline/LAN không internet, nhiều member cùng lúc, laptop và điện thoại, bảo mật (đề chứa đáp án), mất mạng hoặc F5 giữa chừng, khả năng truy cập (a11y), khối lượng vận hành cho mentor.

### Đánh giá nhu cầu designer (UI)

Kết luận một trong ba, kèm lý do ngắn:
- **Không cần UI**: thay đổi chỉ ở luật/dữ liệu, không có gì người dùng nhìn thấy.
- **Dùng lại được UI hiện có**: chỉ thêm/đổi nhỏ bằng component sẵn có (`src/web/shared/ui`), không đổi bố cục hay luồng.
- **Cần designer**: có một trong các dấu hiệu: màn hình hoặc luồng mới; đổi bố cục trang chính; chạm **màn hình chiếu** (cả phòng nhìn, cần đọc được từ xa); trạng thái mới mà member phải hiểu ngay (chờ, khóa, đã nộp...); phải dùng tốt trên cả laptop và điện thoại (§1); có nội dung hiển thị tên/điểm của người khác (nhạy cảm về cảm giác công bằng).

Nếu cần designer, nêu: màn hình nào, actor nào dùng, trạng thái cần thiết kế (rỗng, đang tải, lỗi, mất mạng), và đề xuất soạn **prompt cho designer** theo mẫu có sẵn trong `docs/design/` (ví dụ `member-responsive-ui-prompt.md`). Chỉ đề xuất, không tự soạn khi chưa được duyệt.

## Bước 5. Giả lập actor (chỉ mức Đầy đủ)

Mở **mỗi actor một subagent**, chạy **song song**, để cô lập context và tránh thiên kiến. Mỗi subagent chỉ nhận: yêu cầu gốc (nguyên văn), mô tả actor, đường dẫn `docs/PRODUCT.md`. **Không** đưa phân tích của bước 2–4 cho subagent.

Actor mặc định: Mentor, Member (thông thường). Thêm khi liên quan: Member gặp sự cố (rớt mạng, F5, dùng điện thoại), Member muốn "lách" hoặc phá, Màn hình chiếu (cả phòng nhìn thấy).

Mẫu prompt cho subagent (thay `<ACTOR>`, `<YÊU CẦU>`):

```
Bạn đóng vai <ACTOR> trong app p-quizzz. Đọc docs/PRODUCT.md để hiểu app và vai trò của bạn.
Chỉ trả lời từ góc nhìn của <ACTOR>, bằng tiếng Việt, ngôn ngữ đời thường (không thuật ngữ kỹ thuật).

Yêu cầu mới được đề xuất (nguyên văn): "<YÊU CẦU>"

Trả về:
1. Bạn muốn gì / lo ngại gì khi có tính năng này (tối đa 5 ý).
2. 2–3 kịch bản tốt: "Khi ... thì tôi ... để ...".
3. 2–3 kịch bản xấu hoặc khó chịu (kể cả hiểu nhầm, bất tiện, thấy bất công).
4. Điều bạn KHÔNG muốn actor khác làm được/thấy được.
Không đề xuất giải pháp kỹ thuật. Không đọc code. Không sửa file.
```

## Bước 6. Tổng hợp

- Gộp kịch bản; tìm **xung đột giữa các actor** ("A muốn X, B muốn Y") và nêu đánh đổi.
- Đưa 2–3 phương án (có thể gồm "không làm" hoặc "làm bản tối thiểu"), mỗi phương án có ưu/nhược, độ lớn ước lượng (S/M/L) và các story/module bị chạm (xem `docs/stories/` và `docs/architecture.md` §11). Ước lượng chỉ là thô; nói rõ nếu chưa đủ cơ sở.
- Đưa **một khuyến nghị** kèm lý do.

## Bước 7. Báo cáo PO (trả trong chat)

Ngôn ngữ nghiệp vụ, ngắn gọn, không thuật ngữ kỹ thuật. Dùng đúng khung:

1. **Yêu cầu hiểu lại** và các giả định đã dùng.
2. **Độ phù hợp**: hợp lý / mâu thuẫn ở đâu (trích mục `PRODUCT.md`); MVP hay phase 2.
3. **Giá trị theo actor** (bảng: Mentor, Member, Màn hình chiếu).
4. **Kịch bản** (mỗi cái 1 dòng, dạng "Khi ... thì ... để ..."), gồm cả kịch bản xấu.
5. **Xung đột và đánh đổi** giữa các actor.
6. **Phương án + khuyến nghị** (kèm S/M/L, phần bị chạm).
7. **UI / designer**: không cần / dùng lại UI hiện có / cần designer (màn hình, trạng thái cần thiết kế, có nên soạn prompt designer không).
8. **Câu hỏi mở cần PO quyết** và, nếu PO chấp nhận hướng khuyến nghị, **đề xuất thay đổi `PRODUCT.md`** (chỉ liệt kê mục nào đổi thành gì, chưa ghi).

Kết thúc bằng: "Chờ PO duyệt hướng nào để chuyển bước tiếp theo." Dừng tại đây.

## Không làm

- Không sửa `docs/`, không tạo story, không soạn prompt designer, không viết code, không chạy lệnh thay đổi repo.
- Không thay PO quyết định; chỉ khuyến nghị.
- Không chạy subagent cho yêu cầu mức Nhẹ.
