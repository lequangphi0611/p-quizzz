---
name: exam-authoring
description: Soạn, sửa hoặc rà soát đề thi p-quizzz ở định dạng Markdown có thể import vào app. Dùng khi mentor muốn tạo đề mới, bổ sung câu hỏi, sửa đề theo góp ý, chuyển nội dung (tài liệu, slide, ghi chú, đề cũ dạng Word/"A. B. C.") thành file đề, hoặc kiểm tra một file trong exams/. Trigger: soạn đề, tạo đề, ra đề, thêm câu hỏi, sửa đề, đề thi, quiz, exam.
---

# Soạn đề thi p-quizzz

Mục tiêu: tạo ra một file `exams/<slug>.md` mà **mentor duyệt được nhanh và import được ngay**. File mentor duyệt chính là file được import, nên không có bước "chuyển đổi sau".

Spec cú pháp: `docs/exam-format.md` (đọc trước khi soạn). Ví dụ chuẩn: `exams/examples/git-co-ban.md`.

## Quy trình

### 1. Làm rõ yêu cầu (hỏi gộp một lần, chỉ hỏi những gì còn thiếu)
- **Chủ đề và nguồn nội dung**: mentor đưa tài liệu/link/ghi chú, hay Claude tự soạn từ kiến thức chung?
- **Số câu và tỉ lệ loại câu** (một đáp án / nhiều đáp án / tự luận). Nếu đề có tự luận thì nhắc mentor rằng mentor phải chấm tay các câu đó sau khi đóng phiên. (Mọi đề đều chỉ làm 1 lượt mỗi phiên; muốn làm lại thì mentor mở phiên mới.)
- **Trình độ member** và độ khó mong muốn.
- **Thang điểm**: mặc định mỗi câu 1 điểm, tự luận thường 3–5 điểm.
- **Hỏi lý do** (tuỳ chọn): mặc định Claude tự đề xuất câu nào có `{reason}` theo tiêu chí ở mục "Hỏi lý do" bên dưới. Mentor muốn khác (mọi câu, không câu nào, câu cụ thể) thì theo mentor.
- **Thời gian làm bài** (tuỳ chọn): mentor muốn giới hạn thì ghi `duration: <số phút>` (1–300) vào frontmatter; không nói thì bỏ key (đề không giới hạn). Đây chỉ là mặc định khi tạo phiên, mentor đổi được. Nếu mentor không nêu, có thể gợi ý một con số theo số câu và độ khó, nhưng không tự thêm khi chưa hỏi.

Mentor đã nói rõ thì không hỏi lại. Thiếu chi tiết nhỏ thì tự chọn mặc định hợp lý và ghi lại ở bước 4.

### 2. Soạn
- Ghi vào `exams/<slug>.md`, slug là tiếng Việt không dấu, nối bằng gạch ngang (vd: `exams/git-nang-cao.md`). Thư mục `exams/` đã gitignore vì chứa đáp án: **không commit đề thật**, không đặt đề thật vào `exams/examples/`.
- Sửa đề có sẵn thì sửa trực tiếp trên file, không tạo bản sao.

### 3. Tự kiểm tra (bắt buộc, lặp đến khi sạch)
```bash
npm run exam:check -- exams/<slug>.md
```
- **0 lỗi** là điều kiện tối thiểu. Chưa đạt thì không được đưa cho mentor.
- Mỗi **cảnh báo** phải được sửa, hoặc giữ lại kèm lý do nêu ở bước 4.
- Sau đó tự rà theo checklist chất lượng bên dưới. Validator chỉ bắt lỗi cú pháp, không bắt được đáp án sai.

### 4. Bàn giao cho mentor duyệt
Trả lời ngắn gọn, gồm:
1. Đường dẫn file và dòng tóm tắt từ `exam:check` (số câu, loại câu, tổng điểm, có tự luận hay không).
2. **Những câu cần mentor soi kỹ**, kèm số dòng: câu Claude không chắc 100% đáp án, câu kiến thức phụ thuộc phiên bản/công cụ, câu có thể hiểu theo hai cách. Đây là phần giá trị nhất của bàn giao. Không chắc thì nói không chắc, không được tỏ ra tự tin.
3. Các câu đã gắn `{reason}` (số câu, số dòng) và lý do chọn ngắn gọn, để mentor thêm/bỏ.
4. Các mặc định Claude đã tự chọn, và các cảnh báo còn giữ lại (nếu có).

Không dán lại toàn bộ đề vào chat, vì mentor sẽ duyệt trên file.

### 5. Sửa theo góp ý
Sửa trên file, chạy lại bước 3, rồi báo ngắn những gì đã đổi kèm số dòng.

## Checklist chất lượng câu hỏi

**Đáp án đúng**
- Chỉ có **một cách hiểu** dẫn tới đáp án đúng. Đáp án đúng phải đúng hoàn toàn, đáp án sai phải sai rõ ràng (không phải "kém đúng hơn").
- Kiến thức phụ thuộc phiên bản (thư viện, ngôn ngữ, công cụ) thì ghi rõ phiên bản trong câu hỏi, hoặc tránh dùng.
- Câu có code: tự chạy trong đầu từng dòng; chạy thử được thì nên chạy thử để chắc output.

**Đáp án nhiễu (distractor)**
- Hợp lý với người hiểu sai, tức là lấy từ các hiểu lầm phổ biến. Không dùng đáp án vô lý hay đùa cợt.
- Độ dài và văn phong tương đương đáp án đúng. Đáp án đúng không được luôn là đáp án dài nhất.
- **Không** dùng "Tất cả các đáp án trên", "Không có đáp án nào", "A và B", vì đáp án bị trộn thứ tự. Muốn kiểm tra nhiều ý đúng thì dùng câu nhiều đáp án.
- Thường dùng 4 đáp án, ít nhất 3.

**Câu hỏi**
- Hỏi về hiểu biết hay vận dụng, hạn chế hỏi thuộc lòng vụn vặt. Câu tình huống hoặc đọc code tốt hơn câu định nghĩa.
- Tránh câu phủ định. Nếu buộc phải dùng thì viết **in đậm** chữ **KHÔNG**.
- Tiêu đề `##` ngắn gọn. Code hoặc bối cảnh dài đặt ở phần nội dung bên dưới tiêu đề.
- Câu nhiều đáp án nên có tín hiệu rõ trong câu hỏi ("Những… nào", "Chọn tất cả…") để member biết phải chọn nhiều.
- Các câu không lộ đáp án cho nhau.

**Giải thích (`>`)**: mỗi câu trắc nghiệm đều nên có
- Giải thích **vì sao đáp án đúng là đúng** và **vì sao đáp án nhiễu hấp dẫn nhất là sai**. Member chỉ xem phần này sau khi phiên đóng, nên đây là phần dạy học.
- Tối đa 2–3 câu. Không nhắc tới chữ cái A/B/C vì thứ tự bị trộn; nhắc tới nội dung đáp án.

**Tự luận (`{essay, points=N}`)**
- Câu hỏi giới hạn rõ phạm vi ("nêu 2 lý do", "viết hàm… trả về…").
- Giải thích gồm **đáp án mẫu** và **rubric chia điểm cộng lại bằng N**, để mentor chấm nhanh và nhất quán.
- Rubric viết thành **danh sách tiêu chí, mỗi tiêu chí kèm điểm** (ví dụ `> - Nêu được X (1đ)`), ghi rõ trường hợp không cho điểm hoặc cho một phần. AI dùng đúng rubric này để gợi ý chấm (PRODUCT.md §7.28); câu thiếu rubric sẽ không được AI chấm.

**Hỏi lý do (`{reason}`)**: member phải ghi một câu lý do khi đã chọn đáp án; không tính điểm, chỉ để mentor hiểu cách member nghĩ (PRODUCT.md §7.32).
- **Nên gắn** cho: câu có đáp án nhiễu dựa trên hiểu lầm phổ biến (để thấy member hiểu nhầm ở đâu); câu tình huống "chọn cách làm"; câu dễ đoán mò đúng.
- **Không gắn** cho: câu nhớ định nghĩa, cú pháp, tên lệnh (lý do sẽ chỉ là "vì nhớ vậy"); câu tự luận (`{reason}` với `{essay}` là lỗi).
- **Số lượng**: mặc định khoảng 20–30% số câu trắc nghiệm, để member không mất giờ gõ (nhất là phiên có giới hạn thời gian). Mentor yêu cầu khác thì theo mentor.
- Câu có `{reason}` thì câu hỏi phải đủ rõ để trả lời "vì sao" trong một câu ngắn (tối đa 200 ký tự).

## Chuyển đề cũ sang format

- Đề dạng `A. … B. …`: đổi mỗi lựa chọn thành `- [ ]`/`- [x]` theo đáp án gốc. **Đề gốc không có đáp án thì không tự suy rồi đánh dấu.** Phải hỏi mentor, hoặc đánh dấu theo phán đoán và liệt kê rõ ở bước 4 là "Claude tự xác định đáp án".
- Đề gốc có dòng kiểu "Lý do: ……" dưới câu trắc nghiệm: bỏ dòng đó và gắn `{reason}` vào tiêu đề câu.
- Đề gốc dùng "Tất cả các đáp án trên" thì đổi thành câu nhiều đáp án, và ghi lại thay đổi này ở bước 4.
- Giữ nguyên nội dung câu hỏi. Chỉ sửa lỗi chính tả hoặc sự mơ hồ khi có báo cho mentor.
