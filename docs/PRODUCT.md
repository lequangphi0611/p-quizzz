# p-quizzz — Product Spec

> Trạng thái: **Draft v0.1** — chốt qua phỏng vấn product ngày 2026-11-14.
> Đây là nguồn sự thật về business. Code và CLAUDE.md phải khớp với tài liệu này; khi business đổi, sửa file này trước.

## 1. Bối cảnh & mục tiêu

- Một mentor dẫn một nhóm member trong dự án. Cần công cụ **ôn luyện vui, đỡ chán**, mentor có thể mở thi nhiều lần.
- **Không phải** công cụ thi có hệ quả → chống gian lận ở mức tối thiểu, ưu tiên trải nghiệm và tốc độ vận hành.
- Chạy **local trên máy mentor**, member truy cập qua **mạng LAN** bằng trình duyệt.

### Thước đo thành công (MVP)
- Mentor đi từ "có file đề MD đã duyệt" → "member đang làm bài" trong **< 3 phút**.
- Member vào thi chỉ cần: mở URL + nhập tên. Không cài đặt, không tài khoản.
- Không mất bài khi member F5 / lỡ đóng tab.

## 2. Actors

| Actor | Mô tả | Xác thực |
|---|---|---|
| **Mentor** | Duy nhất 1 người, chủ máy chạy app. Quản lý đề, phiên, chấm tự luận. | Mật khẩu admin cục bộ (đặt lần đầu chạy) |
| **Member** | Người thi. Danh tính chỉ tồn tại trong 1 phiên. | Nhập tên hiển thị khi vào phiên |
| **Màn hình chiếu** | Trang công khai read-only chiếu lên projector. | Không (URL riêng của phiên) |

## 3. Khái niệm cốt lõi

- **Đề thi (Exam)**: nội dung câu hỏi, import từ 1 file Markdown. Dùng lại cho nhiều phiên.
- **Phiên thi (Session)**: một lần mở 1 đề cho nhóm. Có `mode` (MVP chỉ `self_paced`; `live` ở phase 2).
- **Người tham gia (Participant)**: tên + token trình duyệt, thuộc về đúng 1 phiên.
- **Lượt làm bài (Attempt)**: một lần làm của participant.
- **Câu trả lời (Answer)**: đáp án cho 1 câu trong 1 lượt; có điểm tự động hoặc điểm chấm tay.

> Nguyên tắc: tách **Đề** khỏi **Phiên** ngay từ đầu để mở lại đề nhiều lần và để thêm chế độ live sau mà không phá data model.

## 4. Luồng chính (MVP)

### 4.1 Soạn & import đề
1. Mentor + Claude soạn đề trực tiếp ở **định dạng Markdown chuẩn** (mục 6). Mentor duyệt chính file này.
2. Mentor upload file trong app → app **parse + validate + preview**, báo lỗi theo dòng.
3. Hợp lệ → lưu thành Đề. Không hợp lệ → không lưu gì, hiển thị danh sách lỗi.

> File được duyệt **chính là** file được import — không có bước chuyển đổi trung gian.

### 4.2 Vòng đời phiên thi

```
DRAFT ──open──▶ LOBBY ──start──▶ RUNNING ──close──▶ CLOSED ──(chấm xong tự luận)──▶ FINALIZED
```

| Trạng thái | Member | Mentor |
|---|---|---|
| **LOBBY** | Mở URL, nhập tên, chờ | Thấy danh sách người vào realtime, đếm số lượng, đổi tên/kick |
| **RUNNING** | Làm bài, nộp, (làm lại nếu được phép), thấy điểm + xếp hạng | Thấy ai đã nộp; duyệt người vào trễ |
| **CLOSED** | Không nộp được nữa; **xem đáp án + giải thích** | Chấm tự luận (nếu có) |
| **FINALIZED** | Xem điểm chính thức | Xem lại lịch sử phiên |

- Mở/đóng phiên **thủ công** bởi mentor. MVP **không** có giới hạn thời gian làm bài.
- Đề không có tự luận: `CLOSED` tự chuyển `FINALIZED`.

### 4.3 Làm bài
- Thứ tự câu hỏi và thứ tự đáp án **được trộn** theo từng participant (cấu hình bật/tắt theo phiên, mặc định bật).
- Tiến độ làm bài **lưu liên tục phía server**; F5 / mở lại tab → quay về đúng chỗ (token lưu ở trình duyệt).
- Đổi máy/trình duyệt → mentor cho vào lại thủ công.

### 4.4 Luật làm lại

| Loại đề | Số lượt | Lượt được tính |
|---|---|---|
| Có ≥ 1 câu tự luận | **1 lượt** | Lượt duy nhất |
| Thuần trắc nghiệm | **Không giới hạn** (khi phiên RUNNING) | **Lượt điểm cao nhất** |

### 4.5 Chấm điểm

| Loại câu | Cách chấm |
|---|---|
| Trắc nghiệm 1 đáp án | Tự động: đúng = đủ điểm, sai = 0 |
| Trắc nghiệm nhiều đáp án | Tự động: **chọn đúng chính xác tập đáp án đúng** mới có điểm, ngược lại = 0 |
| Tự luận / code | **Mentor chấm tay** (0 → điểm tối đa của câu), kèm nhận xét tuỳ chọn. Không chạy code. |

- Điểm có 2 trạng thái: **Tạm tính** (chỉ phần tự động) và **Chính thức** (sau khi chấm xong tự luận).
- Màn hình chấm: duyệt **theo câu** (1 câu tự luận → bài của tất cả member), hiển thị đáp án mẫu/rubric.

### 4.6 Kết quả & xếp hạng
- **Member**: thấy điểm của mình + bảng xếp hạng phiên (cập nhật realtime). Đáp án + giải thích chỉ hiện khi phiên `CLOSED`.
- **Màn hình chiếu**: trang lớn, realtime — lobby (ai đã vào), trong phiên (ai đã nộp, xếp hạng). Nhãn "Tạm tính" cho đến `FINALIZED`.
- Mỗi phiên độc lập — **không** có xếp hạng tích luỹ qua các phiên. Mentor xem lại được các phiên cũ.

## 5. Phạm vi

### MVP (phase 1)
- Import đề từ Markdown + validate + preview
- Phiên chế độ tự do, lobby, mở/đóng thủ công
- 3 loại câu: single, multi, essay
- Trộn câu/đáp án, luật làm lại như 4.4
- Chấm tự động + màn hình chấm tay tự luận
- Bảng xếp hạng member + màn hình chiếu (realtime mức SSE/polling)
- Chạy offline hoàn toàn trên LAN (không phụ thuộc CDN/internet)

### Phase 2 (đã xác định, chưa làm)
- **Chế độ live** (kiểu game show: mentor điều khiển từng câu, đếm ngược, điểm theo tốc độ)
- Thống kê theo câu cho mentor (câu nhiều người sai, đáp án nhiễu)
- Export/backup đề dạng JSON

### Ngoài phạm vi (không làm trừ khi đổi mục tiêu)
- Nhiều mentor / multi-tenant / deploy internet
- Tài khoản member, lịch sử xuyên phiên
- Chống gian lận (chặn chuyển tab, giám sát)
- Chấm code tự động (sandbox chạy test)
- Câu điền đáp án ngắn
- Giới hạn thời gian làm bài

## 6. Định dạng đề Markdown

Spec đầy đủ: **[docs/exam-format.md](exam-format.md)**. Các quyết định chính:
- Một file Markdown duy nhất vừa để duyệt vừa để import; validate bằng `npm run exam:check`.
- Thuộc tính câu hỏi đặt ở cuối tiêu đề: `{essay}`, `{points=N}`. Key lạ là lỗi (bắt lỗi gõ sai).
- Đáp án luôn bị trộn → validator cảnh báo đáp án kiểu "tất cả các đáp án trên".
- Đề thật không commit vào repo (member có thể đọc được đáp án); chỉ commit `exams/examples/`.

### Quy trình soạn đề
1. Mentor yêu cầu Claude soạn đề (skill `exam-authoring`): chủ đề, số câu, tỉ lệ loại câu, độ khó.
2. Claude soạn vào `exams/<slug>.md`, tự chạy `exam:check` đến khi 0 lỗi.
3. Mentor duyệt chính file đó; Claude sửa theo góp ý, check lại.
4. Mentor import file vào app (màn hình import + preview — chưa làm).

## 7. Vấn đề mở (cần chốt khi triển khai)

Các mục dưới đây đã lấy **mặc định** để chia story (2026-11-14) — chờ mentor xác nhận:

1. Tie-break xếp hạng: bằng điểm → ai nộp sớm hơn xếp trên.
2. Màn hình chiếu: URL công khai trong LAN, không cần mã (chỉ hiện tên + điểm, không hiện đáp án).
3. ~~Cú pháp metadata~~ — đã chốt: `{essay, points=N}` cuối tiêu đề.
4. Đề **bất biến** sau khi import; muốn sửa → import đề mới. Chỉ xoá được đề chưa dùng cho phiên nào.
5. Tối đa **1 phiên hoạt động** (lobby/running) cùng lúc — 1 mentor, 1 phòng; member mở URL gốc là vào đúng phiên.
6. Đóng phiên khi member đang làm dở → **tự nộp** với câu trả lời đã lưu.
7. Vào trễ (phiên đang chạy) → chờ mentor duyệt. Vào lúc lobby → vào thẳng (mentor vẫn kick được).
8. Mỗi lần làm lại được trộn thứ tự mới.
9. Chấm tự luận cho phép điểm lẻ 0.5.
10. Import **không chặn trùng file** (2026-11-15): vì đề bất biến và "sửa = import mới", import nhiều bản giống nhau là bình thường; bản trùng chưa dùng thì xoá được. Chống bấm Import hai lần bằng cách khoá nút khi đang gửi (UI). Cảnh báo "file này đã import ngày X" (so `source_markdown`) để backlog.
11. **Chưa có archive đề** (2026-11-15), hoãn khỏi MVP. Khi làm: thêm cột `archived_at` vào `exams`; archive = ẩn khỏi danh sách chọn để tạo phiên mới, **không** xoá mềm — đề vẫn hiện trong lịch sử phiên và trang chấm điểm. Làm khi danh sách đề rối hoặc khi có lịch sử phiên (S09). Giả định đang dùng: mentor ít sửa đề sau khi đã chạy phiên; nếu ngược lại thì kéo lên ngay sau MVP.
