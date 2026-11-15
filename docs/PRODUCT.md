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
| **RUNNING** | Làm bài, nộp (1 lượt), thấy điểm + xếp hạng | Thấy ai đã nộp; duyệt người vào trễ |
| **CLOSED** | Không nộp được nữa; **xem đáp án + giải thích** | Chấm tự luận (nếu có) |
| **FINALIZED** | Xem điểm chính thức | Xem lại lịch sử phiên |

- Mở/đóng phiên **thủ công** bởi mentor. MVP **không** có giới hạn thời gian làm bài.
- Đề không có tự luận: `CLOSED` tự chuyển `FINALIZED`.

### 4.3 Làm bài
- Thứ tự câu hỏi và thứ tự đáp án **được trộn** theo từng participant (cấu hình bật/tắt theo phiên, mặc định bật).
- Tiến độ làm bài **lưu liên tục phía server**; F5 / mở lại tab → quay về đúng chỗ (token lưu ở trình duyệt).
- Đổi máy/trình duyệt → mentor cho vào lại thủ công.

### 4.4 Luật làm bài: mỗi người 1 lượt

- Mỗi participant làm **đúng 1 lượt** trong mỗi phiên, **mọi loại đề** (kể cả thuần trắc nghiệm). Nộp rồi không làm lại được.
- Muốn làm lại: **mentor mở một phiên mới** từ cùng đề; cả nhóm vào lại phiên mới (nhập tên lại, bảng xếp hạng độc lập — mục 4.6).
- Lượt được tính chính là lượt duy nhất đó.

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
- **Màn hình chiếu**: trang lớn, realtime — lobby (ai đã vào), trong phiên (ai đã nộp, xếp hạng). Nhãn "Tạm tính" cho đến `FINALIZED`. Công khai trong LAN: **chỉ tên và điểm**, không bao giờ có đáp án hay bài làm.
- **Chế độ thảo luận** (sau khi đóng phiên): mentor chiếu **từng câu** lên cho cả lớp cùng mổ xẻ — đề, phân bố lựa chọn của cả lớp, đáp án đúng + lời giải (ẩn trước, bấm mới hiện), và các bài tự luận **ẩn danh**. Tự luận chưa chấm thì cả lớp đi từng bài, bàn rồi **mentor nhập điểm** ngay tại đó; xong thì chốt kết quả. Chỉ mở trong giao diện mentor (máy chiếu là máy mentor); member theo dõi trên màn chiếu và đối chiếu bài của mình ở trang "Xem lại bài" trên điện thoại.
- Mỗi phiên độc lập — **không** có xếp hạng tích luỹ qua các phiên. Mentor xem lại được các phiên cũ qua **id phiên**: ai đã tham gia (kể cả người bị kick, chờ duyệt), điểm, bảng xếp hạng cuối, và bài làm chi tiết từng người (họ chọn gì, đáp án đúng, giải thích, điểm và nhận xét tự luận).

## 5. Phạm vi

### MVP (phase 1)
- Import đề từ Markdown + validate + preview
- Phiên chế độ tự do, lobby, mở/đóng thủ công
- 3 loại câu: single, multi, essay
- Trộn câu/đáp án; mỗi người 1 lượt như 4.4
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
5. Tối đa **1 phiên hoạt động** (lobby/running) cùng lúc — 1 mentor, 1 phòng. Member vào bằng **link có mã phòng** hoặc mở URL gốc rồi nhập mã (xem mục 16).
6. Đóng phiên khi member đang làm dở → **tự nộp** với câu trả lời đã lưu.
7. Vào trễ (phiên đang chạy) → chờ mentor duyệt. Vào lúc lobby → vào thẳng (mentor vẫn kick được).
8. ~~Mỗi lần làm lại được trộn thứ tự mới.~~ — bỏ (2026-11-15): không còn làm lại trong cùng một phiên (mục 15).
9. Chấm tự luận cho phép điểm lẻ 0.5.
10. Import **không chặn trùng file** (2026-11-15): vì đề bất biến và "sửa = import mới", import nhiều bản giống nhau là bình thường; bản trùng chưa dùng thì xoá được. Chống bấm Import hai lần bằng cách khoá nút khi đang gửi (UI). Cảnh báo "file này đã import ngày X" (so `source_markdown`) để backlog.
11. **Chưa có archive đề** (2026-11-15), hoãn khỏi MVP. Khi làm: thêm cột `archived_at` vào `exams`; archive = ẩn khỏi danh sách chọn để tạo phiên mới, **không** xoá mềm — đề vẫn hiện trong lịch sử phiên và trang chấm điểm. Làm khi danh sách đề rối hoặc khi có lịch sử phiên (S09). Giả định đang dùng: mentor ít sửa đề sau khi đã chạy phiên; nếu ngược lại thì kéo lên ngay sau MVP.
12. **Member mất token thì không vào lại được lượt cũ** (2026-11-15), giới hạn đã biết của MVP. F5 trong cùng trình duyệt thì giữ nguyên (token ở `localStorage`, lượt làm dở và thứ tự trộn lưu ở server). Nhưng đổi trình duyệt, tab ẩn danh hoặc xoá dữ liệu trang → mất token; nhập lại tên cũ bị 409 "Tên đã có người dùng". Mentor xử lý thủ công: kick participant cũ rồi cho member vào lại như người mới (mất lượt đang làm). Không có tài khoản nên không xác minh được người xin vào lại. Nếu gặp nhiều trên thực tế → thêm hành động "Cho vào lại" ở mentor (cấp token mới cho đúng participant cũ; cần API ở S08, UI ở S09).
13. **Trang quản trị chỉ mở trên máy chạy app** (2026-11-15). Mọi `/api/admin/*` (kể cả `status`, `setup`, `login`) trả 403 với request từ máy khác trong LAN, nên member không thể thử mật khẩu hay chiếm bước đặt mật khẩu lần đầu. Mentor dùng `http://localhost:<cổng>/admin/login` hoặc chính IP LAN của máy mình. Muốn điều khiển từ thiết bị khác: chạy với `--allow-remote-admin` (hoặc `ALLOW_REMOTE_ADMIN=1`), server in cảnh báo khi khởi động. Còn tồn tại: LAN dùng HTTP nên không mã hoá; chưa giới hạn số lần đăng nhập sai (chỉ quan trọng khi bật remote admin).
14. **Chấm tự luận: tên ẩn mặc định** (2026-11-15). Màn hình chấm hiện "Bài #1, #2…" thay cho tên; mentor bấm bỏ tick "Ẩn tên" mới thấy tên. Mục đích: chấm khách quan.
15. **Mỗi người chỉ làm 1 lượt trong mỗi phiên, mọi loại đề** (2026-11-15). Muốn làm lại thì mentor mở phiên mới cho cả nhóm. Thay cho luật cũ (đề trắc nghiệm làm lại không giới hạn, tính lượt cao nhất): luật cũ cho phép dò đáp án bằng cách đổi từng câu qua các lượt và xem tổng điểm. Hệ quả: member vào lại phiên mới bằng cách nhập tên lại; bảng xếp hạng mỗi phiên độc lập (không cộng dồn).
16. **Mã phòng** (2026-11-15). Khi mentor **mở phòng chờ**, phiên nhận một mã ngẫu nhiên 6 chữ số (duy nhất giữa các phiên). Member chỉ vào được khi có mã: mentor gửi **link có sẵn mã** (`http://địa-chỉ/?room=482913`) hoặc đọc/chiếu mã để member gõ vào ô "Mã phòng". Mã sai → 403; nhập sai quá 5 lần trong 1 phút từ một máy → bị khoá tạm 1 phút. Mã chỉ có tác dụng khi phiên `lobby`/`running`; sang phiên mới thì mã mới, link cũ vô hiệu. Màn hình chiếu hiện mã (lấy qua endpoint chỉ máy mentor gọi được, không để lộ qua API công khai). **Id phiên** (cố định, dùng để mentor tra lịch sử) và **mã phòng** (bí mật, ngắn hạn) là hai thứ khác nhau. Giới hạn đã biết: ai nhìn thấy màn hình chiếu hoặc được chuyển link thì vào được; bảng xếp hạng và danh sách tên vẫn đọc được nếu biết id phiên (chỉ tên và điểm, không đáp án).
17. **Chế độ thảo luận** (2026-11-15). Mở khi phiên `closed`/`finalized`, chỉ từ giao diện mentor. (a) **Mentor là người duy nhất nhập điểm**; học viên cùng bàn, không bỏ phiếu (không có tài khoản → dễ bị chỉnh điểm). (b) **Không hiện tên ở bất kỳ đâu trong chế độ này, không có nút "hiện tên"** — muốn biết ai viết thì xem trang chấm hoặc trang xem lại riêng của mentor. Bài tự luận hiển thị theo **thứ tự đã trộn** (cố định trong phiên) để không đoán được người viết qua thứ tự vào phòng; giới hạn đã biết: văn phong vẫn có thể lộ người viết trong nhóm nhỏ. (c) **Máy chiếu phải là máy mentor** (trang quản trị chỉ mở trên máy mentor). (d) Đáp án đúng và lời giải **mặc định ẩn**, mentor bấm mới hiện, để lớp tranh luận trước — *giả định, chờ PO xác nhận; bản thiết kế đã theo hướng này*. (e) Điện thoại member **không** tự nhảy theo câu đang chiếu (để dành cho thiết kế chế độ live, phase 2).
