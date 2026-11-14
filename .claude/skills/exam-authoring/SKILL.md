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
- **Số câu và tỉ lệ loại câu** (một đáp án / nhiều đáp án / tự luận). Nếu đề có tự luận thì nhắc mentor rằng **member chỉ được làm 1 lần** và mentor phải chấm tay. Đề dùng để luyện đi luyện lại thì nên thuần trắc nghiệm.
- **Trình độ member** và độ khó mong muốn.
- **Thang điểm**: mặc định mỗi câu 1 điểm, tự luận thường 3–5 điểm.

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
1. Đường dẫn file và dòng tóm tắt từ `exam:check` (số câu, loại câu, tổng điểm, có cho làm lại hay không).
2. **Những câu cần mentor soi kỹ**, kèm số dòng: câu Claude không chắc 100% đáp án, câu kiến thức phụ thuộc phiên bản/công cụ, câu có thể hiểu theo hai cách. Đây là phần giá trị nhất của bàn giao. Không chắc thì nói không chắc, không được tỏ ra tự tin.
3. Các mặc định Claude đã tự chọn, và các cảnh báo còn giữ lại (nếu có).

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

## Chuyển đề cũ sang format

- Đề dạng `A. … B. …`: đổi mỗi lựa chọn thành `- [ ]`/`- [x]` theo đáp án gốc. **Đề gốc không có đáp án thì không tự suy rồi đánh dấu.** Phải hỏi mentor, hoặc đánh dấu theo phán đoán và liệt kê rõ ở bước 4 là "Claude tự xác định đáp án".
- Đề gốc dùng "Tất cả các đáp án trên" thì đổi thành câu nhiều đáp án, và ghi lại thay đổi này ở bước 4.
- Giữ nguyên nội dung câu hỏi. Chỉ sửa lỗi chính tả hoặc sự mơ hồ khi có báo cho mentor.
