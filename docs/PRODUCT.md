# p-quizzz — Product Spec

> Trạng thái: **Draft v0.1** — chốt qua phỏng vấn product ngày 2026-11-14.
> Đây là nguồn sự thật về business. Code và CLAUDE.md phải khớp với tài liệu này; khi business đổi, sửa file này trước.

## 1. Bối cảnh & mục tiêu

- Một mentor dẫn một nhóm member trong dự án. Cần công cụ **ôn luyện vui, đỡ chán**, mentor có thể mở thi nhiều lần.
- **Không phải** công cụ thi có hệ quả → chống gian lận ở mức tối thiểu, ưu tiên trải nghiệm và tốc độ vận hành.
- Chạy **local trên máy mentor**, member truy cập qua **mạng LAN** bằng trình duyệt — **phần lớn từ laptop/desktop, một số từ điện thoại**; giao diện member phải dùng tốt trên cả hai (không thiết kế riêng cho điện thoại).

### Thước đo thành công (MVP)
- Mentor đi từ "có file đề MD đã duyệt" → "member đang làm bài" trong **< 3 phút**.
- Member vào thi chỉ cần: mở URL + nhập mã phòng + tên (§7.16). Phiên giới hạn theo nhóm (§7.22) thêm một ô email. Không cài đặt, không tài khoản.
- Không mất bài khi member F5 / lỡ đóng tab.

## 2. Actors

| Actor | Mô tả | Xác thực |
|---|---|---|
| **Mentor** | Duy nhất 1 người, chủ máy chạy app. Quản lý đề, phiên, chấm tự luận. | Mật khẩu admin cục bộ (đặt lần đầu chạy) |
| **Member** | Người thi. Danh tính chỉ tồn tại trong 1 phiên. | Nhập tên hiển thị khi vào phiên (phiên nhóm: thêm email, §7.22) |
| **Màn hình chiếu** | Trang công khai read-only chiếu lên projector. | Không (URL riêng của phiên) |

## 3. Khái niệm cốt lõi

- **Đề thi (Exam)**: nội dung câu hỏi, import từ 1 file Markdown. Dùng lại cho nhiều phiên.
- **Phiên thi (Session)**: một lần mở 1 đề cho nhóm. Có `mode` (MVP chỉ `self_paced`; `live` ở phase 2).
- **Nhóm (Group)**: tên + tập email đầy đủ do mentor lưu, dùng lại cho nhiều phiên (§7.22). Không phải tài khoản member. Khi tạo phiên, danh sách được **chụp** vào phiên (**danh sách phiên**).
- **Người tham gia (Participant)**: tên + token trình duyệt (phiên nhóm: thêm email), thuộc về đúng 1 phiên.
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
| **LOBBY** | Mở URL, nhập tên (phiên nhóm: thêm email), chờ | Thấy danh sách người vào realtime, đếm số lượng, đổi tên/kick |
| **RUNNING** | Làm bài, nộp (1 lượt), thấy điểm + xếp hạng (phiên **giữ điểm**: chỉ thấy đã nộp + giờ nộp, §7.25) | Thấy ai đã nộp **và giờ nộp**; duyệt người vào trễ; công bố điểm (§7.25) |
| **CLOSED** | Không nộp được nữa; **xem đáp án + giải thích** | Chấm tự luận (nếu có) |
| **FINALIZED** | Xem điểm chính thức | Xem lại lịch sử phiên |

- Mở/đóng phiên **thủ công** bởi mentor. MVP **không** có giới hạn thời gian làm bài. Nhiều phiên có thể hoạt động **cùng lúc** (§7.5).
- Đề không có tự luận: `CLOSED` tự chuyển `FINALIZED`.

### 4.3 Làm bài
- Thứ tự câu hỏi và thứ tự đáp án **được trộn** theo từng participant (cấu hình bật/tắt theo phiên, mặc định bật).
- Tiến độ làm bài **lưu liên tục phía server**; F5 / mở lại tab → quay về đúng chỗ (token lưu ở trình duyệt).
- Đổi máy/trình duyệt → mentor cho vào lại thủ công.

### 4.4 Luật làm bài: mỗi người 1 lượt

- Mỗi participant làm **đúng 1 lượt** trong mỗi phiên, **mọi loại đề** (kể cả thuần trắc nghiệm). Nộp rồi không làm lại được.
- Muốn làm lại: **mentor mở một phiên mới** từ cùng đề; cả nhóm vào lại phiên mới (nhập tên lại, bảng xếp hạng độc lập — mục 4.6).
- Lượt được tính chính là lượt duy nhất đó.
- **Ngoại lệ có kiểm soát: xin sửa bài tự luận** (mục 7.21). Sau khi nộp, member có thể xin mentor mở lại **phần tự luận** của lượt đó (1 lần/lượt, có lý do). Phần trắc nghiệm và điểm tự động không bao giờ thay đổi.

### 4.5 Chấm điểm

| Loại câu | Cách chấm |
|---|---|
| Trắc nghiệm 1 đáp án | Tự động: đúng = đủ điểm, sai = 0 |
| Trắc nghiệm nhiều đáp án | Tự động: **chọn đúng chính xác tập đáp án đúng** mới có điểm, ngược lại = 0 |
| Tự luận / code | **Mentor chấm tay** (0 → điểm tối đa của câu), kèm nhận xét tuỳ chọn. Không chạy code. |

- Điểm có 2 trạng thái: **Tạm tính** (chỉ phần tự động) và **Chính thức** (sau khi chấm xong tự luận).
- Màn hình chấm: duyệt **theo câu** (1 câu tự luận → bài của tất cả member), hiển thị đáp án mẫu/rubric.

### 4.6 Kết quả & xếp hạng
- **Member**: thấy điểm của mình + bảng xếp hạng phiên (cập nhật realtime), trừ khi mentor chọn **giữ điểm tới khi công bố** (§7.25). Đáp án + giải thích chỉ hiện khi phiên `CLOSED`.
- **Màn hình chiếu**: trang lớn, realtime — lobby (ai đã vào), trong phiên (ai đã nộp, xếp hạng). Nhãn "Tạm tính" cho đến `FINALIZED`. Phiên đang giữ điểm (§7.25): chỉ hiện ai đã nộp, không điểm, không thứ hạng. Công khai trong LAN: **chỉ tên và điểm**, không bao giờ có đáp án hay bài làm.
- **Chế độ thảo luận** (sau khi đóng phiên): mentor chiếu **từng câu** lên cho cả lớp cùng mổ xẻ — đề, phân bố lựa chọn của cả lớp, đáp án đúng + lời giải (ẩn trước, bấm mới hiện), và các bài tự luận **ẩn danh**. Tự luận chưa chấm thì cả lớp đi từng bài, bàn rồi **mentor nhập điểm** ngay tại đó; xong thì chốt kết quả. Chỉ mở trong giao diện mentor (máy chiếu là máy mentor); member theo dõi trên màn chiếu và đối chiếu bài của mình ở trang "Xem lại bài" trên máy của mình.
- Mỗi phiên độc lập — **không** có xếp hạng tích luỹ qua các phiên. Mentor xem lại được các phiên cũ qua **id phiên**: ai đã tham gia (kể cả người bị kick, chờ duyệt), điểm, bảng xếp hạng cuối, và bài làm chi tiết từng người (họ chọn gì, đáp án đúng, giải thích, điểm và nhận xét tự luận).

## 5. Phạm vi

### MVP (phase 1)
- Import đề từ Markdown + validate + preview
- Phiên chế độ tự do, lobby, mở/đóng thủ công
- Nhiều phiên hoạt động song song (§7.5)
- Nhóm học viên theo email: phiên giới hạn theo nhóm, ngoại lệ chờ duyệt, xin vào lại khi trùng (§7.22–7.24)
- 3 loại câu: single, multi, essay
- Trộn câu/đáp án; mỗi người 1 lượt như 4.4
- Chấm tự động + màn hình chấm tay tự luận
- Bảng xếp hạng member + màn hình chiếu (realtime mức SSE/polling)
- Chạy offline hoàn toàn trên LAN (không phụ thuộc CDN/internet)

### Phase 2 (đã xác định, chưa làm)
- **Chế độ live** (kiểu game show: mentor điều khiển từng câu, đếm ngược, điểm theo tốc độ)
- Thống kê theo câu cho mentor (câu nhiều người sai, đáp án nhiễu)
- Export/backup đề dạng JSON
- Tên vui ngẫu nhiên khi vào phiên

### Ngoài phạm vi (không làm trừ khi đổi mục tiêu)
- Nhiều mentor / multi-tenant / deploy internet
- Tài khoản member, lịch sử xuyên phiên (nhóm §7.22 chỉ là danh sách của mentor; không có xếp hạng hay thống kê theo email qua các phiên)
- Xác minh email bằng thư (app chạy offline trên LAN)
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
5. ~~Tối đa **1 phiên hoạt động** (lobby/running) cùng lúc.~~ — bỏ (2026-11-16): **nhiều phiên hoạt động cùng lúc** (mentor dạy nhiều nhóm, mỗi nhóm một phiên). Mỗi phiên có mã phòng riêng (§7.16) và **tên phiên** do mentor đặt (mặc định "tên đề – ngày") để phân biệt. Tên phiên **chỉ mentor thấy**: member và màn chiếu chỉ thấy tên đề, để tên nhóm không lộ (§7.24). Mỗi phiên đang mở có **số slot** (số nhỏ nhất chưa dùng trong các phiên đang mở, giải phóng khi đóng) để mentor phân biệt nhanh và chuyển bằng `Alt+1`…`Alt+9`. Không còn khái niệm "phiên đang hoạt động duy nhất": member vào bằng **link có mã phòng** hoặc mở URL gốc rồi nhập mã, server tra phiên theo mã. Màn hình chiếu có URL riêng theo phiên (mở `/screen` khi có nhiều phiên thì mentor chọn phiên). Chế độ thảo luận vẫn chiếu **một phiên mỗi lúc** (máy chiếu là máy mentor, §7.17). Chuông mentor theo dõi mọi phiên đang mở (§7.20). Không đặt giới hạn số phiên; giới hạn thực tế là sự chú ý của mentor (duyệt người vào ở nhiều phòng cùng lúc).
6. Đóng phiên khi member đang làm dở → **tự nộp** với câu trả lời đã lưu.
7. **Mentor duyệt người vào** (2026-11-15, đổi từ "lobby vào thẳng"). Mặc định mọi người vào phiên (lobby hay đang chạy) đều ở trạng thái chờ duyệt, mentor bấm Duyệt từng người hoặc "Duyệt tất cả". Lý do: một người có thể vào bằng nhiều tên để làm nhiều lượt hoặc dò đáp án qua điểm. Giới hạn đã biết: chỉ hiệu quả khi mentor biết mặt cả nhóm, tên nghe hợp lý thì không phân biệt được. Khi nhóm toàn người quen, mentor bật **"Tự động duyệt người vào"** lúc tạo phiên: ai nhập đúng mã phòng là vào thẳng (kể cả vào trễ); mentor vẫn kick được. Phiên giới hạn theo nhóm (§7.22): email nằm trong danh sách = đã được duyệt sẵn; công tắc tự động duyệt chỉ áp dụng cho phiên tự do.
8. ~~Mỗi lần làm lại được trộn thứ tự mới.~~ — bỏ (2026-11-15): không còn làm lại trong cùng một phiên (mục 15).
9. Chấm tự luận cho phép điểm lẻ 0.5.
10. Import **không chặn trùng file** (2026-11-15): vì đề bất biến và "sửa = import mới", import nhiều bản giống nhau là bình thường; bản trùng chưa dùng thì xoá được. Chống bấm Import hai lần bằng cách khoá nút khi đang gửi (UI). Cảnh báo "file này đã import ngày X" (so `source_markdown`) để backlog.
11. **Chưa có archive đề** (2026-11-15), hoãn khỏi MVP. Khi làm: thêm cột `archived_at` vào `exams`; archive = ẩn khỏi danh sách chọn để tạo phiên mới, **không** xoá mềm — đề vẫn hiện trong lịch sử phiên và trang chấm điểm. Làm khi danh sách đề rối hoặc khi có lịch sử phiên (S09). Giả định đang dùng: mentor ít sửa đề sau khi đã chạy phiên; nếu ngược lại thì kéo lên ngay sau MVP.
12. **Member mất token thì không vào lại được lượt cũ** (2026-11-15), giới hạn đã biết của MVP. _(Cập nhật 2026-11-16: thay bằng luồng **xin vào lại**, §7.23; phần còn lại của mục này là hiện trạng trước khi có luồng đó.)_ F5 trong cùng trình duyệt thì giữ nguyên (token ở `localStorage`, lượt làm dở và thứ tự trộn lưu ở server). Nhưng đổi trình duyệt, tab ẩn danh hoặc xoá dữ liệu trang → mất token; nhập lại tên cũ bị 409 "Tên đã có người dùng". Mentor xử lý thủ công: kick participant cũ rồi cho member vào lại như người mới (mất lượt đang làm). Không có tài khoản nên không xác minh được người xin vào lại. Nếu gặp nhiều trên thực tế → thêm hành động "Cho vào lại" ở mentor (cấp token mới cho đúng participant cũ; cần API ở S08, UI ở S09).
13. **Trang quản trị chỉ mở trên máy chạy app** (2026-11-15). Mọi `/api/admin/*` (kể cả `status`, `setup`, `login`) trả 403 với request từ máy khác trong LAN, nên member không thể thử mật khẩu hay chiếm bước đặt mật khẩu lần đầu. Mentor dùng `http://localhost:<cổng>/admin/login` hoặc chính IP LAN của máy mình. Muốn điều khiển từ thiết bị khác: chạy với `--allow-remote-admin` (hoặc `ALLOW_REMOTE_ADMIN=1`), server in cảnh báo khi khởi động. Còn tồn tại: LAN dùng HTTP nên không mã hoá; chưa giới hạn số lần đăng nhập sai (chỉ quan trọng khi bật remote admin).
14. **Chấm tự luận: tên ẩn mặc định** (2026-11-15). Màn hình chấm hiện "Bài #1, #2…" thay cho tên; mentor bấm bỏ tick "Ẩn tên" mới thấy tên. Mục đích: chấm khách quan.
15. **Mỗi người chỉ làm 1 lượt trong mỗi phiên, mọi loại đề** (2026-11-15). Muốn làm lại thì mentor mở phiên mới cho cả nhóm. Thay cho luật cũ (đề trắc nghiệm làm lại không giới hạn, tính lượt cao nhất): luật cũ cho phép dò đáp án bằng cách đổi từng câu qua các lượt và xem tổng điểm. Hệ quả: member vào lại phiên mới bằng cách nhập tên lại; bảng xếp hạng mỗi phiên độc lập (không cộng dồn).
16. **Mã phòng** (2026-11-15). Khi mentor **mở phòng chờ**, phiên nhận một mã ngẫu nhiên 6 chữ số (duy nhất giữa các phiên). Member chỉ vào được khi có mã: mentor gửi **link có sẵn mã** (`http://địa-chỉ/?room=482913`) hoặc đọc/chiếu mã để member gõ vào ô "Mã phòng". Mã sai → 403; nhập sai quá 5 lần trong 1 phút từ một máy → bị khoá tạm 1 phút. Mã chỉ có tác dụng khi phiên `lobby`/`running`; sang phiên mới thì mã mới, link cũ vô hiệu. Màn hình chiếu hiện mã (lấy qua endpoint chỉ máy mentor gọi được, không để lộ qua API công khai). **Id phiên** (cố định, dùng để mentor tra lịch sử) và **mã phòng** (bí mật, ngắn hạn) là hai thứ khác nhau. Giới hạn đã biết: ai nhìn thấy màn hình chiếu hoặc được chuyển link thì vào được; bảng xếp hạng và danh sách tên vẫn đọc được nếu biết id phiên (chỉ tên và điểm, không đáp án). Khi có nhiều phiên song song (§7.5), server **tra phiên theo mã phòng**; việc tra mã dùng chung bộ giới hạn 5 lần sai/phút ở trên (nếu không thì quét 1 triệu mã được).
17. **Chế độ thảo luận** (2026-11-15). Mở khi phiên `closed`/`finalized`, chỉ từ giao diện mentor. (a) **Mentor là người duy nhất nhập điểm**; học viên cùng bàn, không bỏ phiếu (không có tài khoản → dễ bị chỉnh điểm). (b) **Không hiện tên ở bất kỳ đâu trong chế độ này, không có nút "hiện tên"** — muốn biết ai viết thì xem trang chấm hoặc trang xem lại riêng của mentor. Bài tự luận hiển thị theo **thứ tự đã trộn** (cố định trong phiên) để không đoán được người viết qua thứ tự vào phòng; giới hạn đã biết: văn phong vẫn có thể lộ người viết trong nhóm nhỏ. (c) **Máy chiếu phải là máy mentor** (trang quản trị chỉ mở trên máy mentor). (d) Đáp án đúng và lời giải **mặc định ẩn**, mentor bấm mới hiện, để lớp tranh luận trước (PO xác nhận 2026-11-15). (e) Điện thoại member **không** tự nhảy theo câu đang chiếu (để dành cho thiết kế chế độ live, phase 2).
18. **Giao diện member cho cả máy tính và điện thoại** (2026-11-15). Học viên chủ yếu dùng laptop/desktop. Khi làm bài: **mỗi màn một câu** ở mọi khổ màn hình (máy tính có thêm danh sách câu bên cạnh). Máy tính có phím tắt (`←`/`→` chuyển câu, `1`–`9` chọn phương án), **tắt khi đang gõ trong ô nhập**. Thiết kế: [prompt](design/member-responsive-ui-prompt.md).
19. **Điểm tạm tính chỉ gồm phần tự động** (2026-11-15, sửa code cho khớp mục 4.5). Cho đến khi `FINALIZED`, bảng xếp hạng và danh sách mentor chỉ cộng điểm trắc nghiệm; điểm tự luận mentor vừa chấm chưa hiện ra ngoài (kể cả màn chiếu), tránh lộ điểm chấm dở dang. Chốt xong mới cộng vào.
20. **Chuông thông báo cho mentor** (2026-11-16). Ở mọi trang quản trị (trừ chế độ thảo luận toàn màn hình), header có biểu tượng chuông theo dõi **mọi phiên đang mở** (`lobby`/`running`; mỗi thông báo gắn **tên phiên**, §7.5): báo khi có người **xin vào / đã vào** và khi có người **nộp bài**. Badge = số thông báo chưa xem; tiêu đề tab đổi thành `(N) p-quizzz` để mentor thấy cả khi đang ở tab/ứng dụng khác. Người **chờ duyệt** được làm nổi bật (chấm vàng trên chuông cho tới khi duyệt hết) và **duyệt được ngay trong chuông**, vì không duyệt thì học viên bị kẹt ở phòng chờ. Mở chuông = đã xem hết. Không lưu thông báo riêng: danh sách dựng lại từ dữ liệu phiên (giờ vào, giờ nộp), mốc "đã xem" lưu ở trình duyệt mentor, nên F5 không mất. **Thông báo desktop** (hệ điều hành, tuỳ chọn, mentor tự bật trong chuông): chỉ cho người **chờ duyệt**, chỉ bật lên khi mentor không đang nhìn trang quản trị (tab ẩn hoặc đang ở cửa sổ khác), không báo lại người đã chờ trước khi tải trang; nhiều người vào liên tiếp trong 15 giây → gộp thành một thông báo "N người đang chờ duyệt" tự cập nhật. Bấm vào thông báo → mở trang điều khiển phiên. Giới hạn: trình duyệt chỉ cho phép khi mở trang quản trị bằng `http://localhost:<cổng>`, mở bằng IP thì bị chặn (chuông hiện hướng dẫn). Chưa làm: âm thanh; thông báo khi phiên đã đóng. Phím tắt (2026-11-16): `N` mở/đóng chuông, `↑`/`↓` + `Enter` chọn thông báo, `Esc` đóng; `Alt+1`…`Alt+9` chuyển nhanh sang phiên có số slot tương ứng (§7.5).
21. **Xin sửa bài tự luận sau khi nộp** (2026-11-16). Bài tự luận dài, học viên nộp rồi mới nhớ ra cần bổ sung. Quy tắc: (a) chỉ xin được khi phiên `running` và lượt đã nộp; **bắt buộc có lý do** (tối đa 500 ký tự); mỗi lượt có **một yêu cầu đang chờ** tại một thời điểm. (b) Mentor **Duyệt** hoặc **Từ chối** (cả hai trong chuông và trên trang điều khiển phiên). Từ chối → member được gửi lại yêu cầu mới. Duyệt → member sửa được **chỉ các câu tự luận** của lượt đó, bấm **"Xong, lưu bài"** để đóng; mỗi lượt chỉ được duyệt **1 lần**. (c) **Trắc nghiệm bị khoá, điểm tự động và `submitted_at` giữ nguyên**, nên xếp hạng không đổi và không dò được đáp án qua việc "xem điểm rồi sửa lại" (lý do §7.15). (d) Phiên `closed` mà yêu cầu còn chờ → tự hết hiệu lực; đang sửa dở thì giữ nội dung đã lưu. (e) Chuông mentor thêm loại thông báo **"xin sửa bài"** (nổi bật như người chờ duyệt, duyệt/từ chối ngay trong chuông). Lý do chọn "chỉ tự luận": tạm dừng phiên để thảo luận giữa chừng đã được cân nhắc và **bỏ** (đáp án chỉ hiện sau `CLOSED`, nên không có gì để chiếu khi đang chạy). Giới hạn đã biết: mentor không biết học viên sẽ sửa gì; bản sửa không lưu lịch sử bản cũ. Chưa làm: lưu lịch sử yêu cầu bị từ chối, thông báo desktop riêng cho loại này (dùng chung cơ chế §7.20).
22. **Nhóm học viên và phiên giới hạn theo email** (2026-11-16). Mentor muốn chỉ người trong lớp mới vào được phiên và dùng lại danh sách lớp cho nhiều phiên. (a) **Nhóm** = tên + tập email đầy đủ (`id@domain`), chỉ mentor tạo/sửa/xoá. Không có khái niệm "domain + id" hay "cho cả một domain". Khi nhập, mentor dán nhiều email (xuống dòng hoặc dấu phẩy); ô **domain mặc định** chỉ là tiện ích nhập (dòng chưa có `@` thì tự thêm), dữ liệu lưu luôn là email đầy đủ; có bước xem trước (hợp lệ / gộp vì trùng / sai định dạng). (b) **Tên và email so khớp không phân biệt hoa thường, không bỏ dấu** (khác dấu là khác tên); email được cắt khoảng trắng và đổi chữ thường khi lưu. (c) Khi tạo phiên mentor chọn **ai được vào**: **Tự do** (như trước, chỉ nhập tên), **Chỉ nhóm** (chọn nhóm đã lưu), hoặc **Danh sách tạm** (nhập nhanh, nhóm tạm không tên đi theo phiên; lưu thành nhóm được sau đó, và app nhắc mentor lưu: nhắc hoãn được, danh sách tạm không tự xoá). Không nhầm với chế độ `self_paced` ở §5: đây là cách kiểm soát **ai được vào**, không phải cách thi. (d) **Danh sách phiên là bản chụp lúc tạo phiên**: sửa/xoá nhóm sau đó không ảnh hưởng phiên đang chạy hay lịch sử. Mentor có thể **thêm email riêng cho một phiên đang chạy** (ngoại lệ, không sửa nhóm gốc). (e) Member vào phiên nhóm bằng **mã phòng + tên + email**; tên là tên hiển thị tự do (không trùng, §2). Email nằm trong danh sách → vào thẳng (không cần mentor duyệt). Email ngoài danh sách → mặc định **chặn** với một thông báo chung "Email này không có trong danh sách của phòng"; không phân biệt "sai đuôi" hay "không có", không nói email nào thuộc nhóm (tránh dò danh sách). Mentor chọn theo từng phiên **Chặn** (mặc định) hoặc **Cho xin duyệt**: ở chế độ sau họ vào trạng thái chờ như §7.7 và mentor duyệt/từ chối. Nhập sai quá nhiều lần tính chung bộ giới hạn §7.16. (f) **Một email = một người tham gia mỗi phiên**; cùng một email được dùng ở hai phiên song song khác nhau. (g) Giới hạn đã biết: app chạy offline nên **không xác minh được chủ email**. Danh sách chặn được người lạ nhưng không chặn người biết email của bạn mình vào trước; xử lý bằng luồng xin vào lại (§7.23). (h) Hoãn: tên vui ngẫu nhiên khi vào phiên.
23. **Xin vào lại khi email/tên đã có người vào** (2026-11-16, thay cách xử lý thủ công ở §7.12). (a) Member nhập email (phiên nhóm) hoặc tên (phiên tự do) đã có người tham gia trong phiên → thay vì lỗi cụt, member thấy màn xác nhận: "Đúng là tôi, xin mentor cho vào lại" hoặc "Không phải tôi, nhập lại". Màn này **không hiện thông tin gì về người đang giữ chỗ**. Chi phí đã biết: nó cho biết email đó có trong danh sách và đã có người vào. (b) Yêu cầu gửi tới mentor (chuông + trang điều khiển phiên). Một người giữ chỗ có thể có **nhiều yêu cầu cùng lúc** (người thật và người mạo danh), mentor thấy hết để phân biệt. Thẻ yêu cầu cho mentor: tên và **trạng thái kết nối** của người đang giữ chỗ (online / ngắt kết nối từ HH:MM), tên hiển thị người xin vừa nhập, giờ xin. (c) Mentor có **ba kết quả**: **Cho vào lại, giữ bài** (thiết bị mới thay thiết bị cũ, giữ tên hiển thị và bài làm dở/đã nộp; thiết bị cũ mất quyền và được báo "đã mở ở thiết bị khác"); **Đây là mạo danh** (người đang giữ chỗ bị mời ra và **mất lượt**, người xin vào như người mới với tên họ nhập; cần cảnh báo rõ trước khi bấm); **Từ chối**. Duyệt một yêu cầu thì các yêu cầu khác của cùng người giữ chỗ tự bị từ chối. (d) **Không bao giờ tự duyệt**, kể cả khi người giữ chỗ đã ngắt kết nối: nếu không, ai đó chờ người thật rớt mạng rồi gõ email để chiếm bài. Trạng thái kết nối chỉ là thông tin để mentor quyết. (e) Mentor cũng có thể **chủ động cho phép vào lại** với người đang ngắt kết nối: member nhập lại đúng email/tên đó trong thời hạn ngắn (mặc định 10 phút, dùng một lần) thì vào thẳng, không cần chờ. (f) F5 trong cùng trình duyệt vẫn giữ chỗ nhờ token, **không** hiện màn xác nhận. (g) Yêu cầu hết hiệu lực khi phiên `closed`; member huỷ được; bị từ chối thì gửi lại được. Chuông mentor thêm loại thông báo **"xin vào lại"** (nổi bật như người chờ duyệt, xử lý ngay trong chuông, kèm tên phiên). Không lưu lịch sử yêu cầu đã xử lý. (h) Khi từ 3 người trở lên ngắt kết nối trong 30 giây, trang điều khiển gộp thành **một cảnh báo** thay vì nhiều dòng (thường do Wi-Fi của lớp); mỗi người vẫn hiện trạng thái riêng trong bảng.
24. **Quyền xem email** (2026-11-16). Email là thông tin cá nhân; **chỉ mentor thấy**. Mentor thấy ở: màn quản lý nhóm, trang điều khiển phiên, thẻ yêu cầu vào lại/chờ duyệt, trang xem lại phiên của mentor. **Không ai khác thấy** ở bất kỳ đâu: màn hình chiếu, bảng xếp hạng, danh sách phòng chờ phía member, chế độ thảo luận, màn chấm bài (kể cả khi bỏ tick "Ẩn tên", §7.14); API công khai và API member không bao giờ trả email. Màn hình chiếu **không hiện tên nhóm** và **không hiện tên phiên** (chỉ tên đề); với phiên nhóm chỉ hiện số "đã vào X/N" (không hiện tên người chưa vào). Giới hạn đã biết: email lưu nguyên văn trong file DB trên máy mentor; không có xếp hạng hay thống kê theo email qua các phiên.
25. **Ẩn/hiện điểm theo phiên** (2026-11-17). Người nộp sớm thấy điểm trắc nghiệm rồi nhắc bài cho người đang làm; mentor muốn tự chọn lúc công bố. (a) Khi tạo phiên mentor chọn **"Hiện ngay khi nộp"** (mặc định, như trước) hoặc **"Giữ tới khi công bố"**. (b) Khi đang giữ: member nộp xong chỉ thấy **đã nộp + giờ nộp** và dòng "Điểm sẽ được công bố sau"; bảng xếp hạng phía member và màn chiếu chỉ hiện **ai đã nộp** (theo thứ tự nộp), không điểm, không thứ hạng. Mentor **luôn thấy điểm** ở trang điều khiển. (c) Mentor bấm **"Công bố điểm"** (có xác nhận, cảnh báo nếu còn người chưa nộp) → điểm và xếp hạng hiện cùng lúc cho mọi người; **công bố rồi không ẩn lại**. (d) **Đóng phiên thì tự công bố** (lưới an toàn chống quên; khớp với việc đáp án mở ở `CLOSED`). (e) **Chỉ đổi được lựa chọn khi chưa ai nộp** (kể cả người đã bị kick): sau đó đổi qua lại sẽ làm người nộp trước và sau bị đối xử khác nhau. (f) **Giờ nộp**: mentor thấy cột "Nộp lúc" ở trang điều khiển phiên và trang xem lại phiên. API bảng xếp hạng công khai vẫn trả giờ nộp như trước (PO chọn giữ nguyên, 2026-11-17); giao diện member và màn chiếu không hiển thị giờ nộp của người khác. Không làm: mức "giữ tới khi chốt kết quả" (điểm trước khi chốt vốn chỉ là tạm tính, §7.19).
26. **Gửi lời mời nhiều phiên** (2026-11-17). Mentor mở nhiều phiên cho nhiều nhóm (§7.5) và mất công gửi link từng phiên. Ở danh sách phiên, nút **"Gửi lời mời"** mở hộp thoại: mentor tick các phiên đang `lobby`/`running` (mặc định chọn hết), app tạo một đoạn tin gồm **tên đề + trạng thái + link có mã + mã phòng** của từng phiên, kèm một dòng hướng dẫn vào (nhắc nhập email nếu có phiên nhóm). Mentor sửa được nội dung rồi sao chép và tự dán vào nhóm chat của lớp. (a) Tin **không bao giờ chứa tên phiên, tên nhóm hay email** (§7.5, §7.24). (b) Chọn nhiều phiên cùng đề → cảnh báo member dễ vào nhầm phòng (mất lượt, §4.4), gợi ý gửi riêng cho từng nhóm. (c) Phiên `draft` chưa có mã nên không mời được. (d) **App không có trang công khai liệt kê các phiên đang mở**: mã phòng chỉ đến tay member qua link mentor gửi hoặc qua màn chiếu, để mã còn tác dụng chặn người lạ (§7.16). Đã cân nhắc và **bỏ**: trang công khai liệt kê phiên, "đăng ký trước" cho phiên chưa mở (khái niệm giống tài khoản, mở đường giữ chỗ bằng email người khác).
