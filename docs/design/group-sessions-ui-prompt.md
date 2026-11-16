# Prompt thiết kế UI — Phiên song song, Nhóm (group) theo email, Xin vào lại

> Dán nguyên phần dưới đường kẻ vào công cụ thiết kế có **p-quizzz Design System**.
> Luật nghiệp vụ trong prompt đã thống nhất với PO ngày 2026-11-16 và đã ghi vào [PRODUCT.md](../PRODUCT.md) §7.5, §7.22–7.24 (cùng §4.2, §4.4, §7.7, §7.12, §7.14, §7.16, §7.20, §7.21). Khi có khác biệt thì PRODUCT.md là chuẩn. Story: [S20](../stories/S20-parallel-sessions.md), [S21](../stories/S21-groups-email.md), [S22](../stories/S22-rejoin-request.md).
> Màn hiện tại để tham chiếu (mentor): `features/session-admin/ui/{SessionListPage,CreateSessionForm,SessionDetailPage,JoinCard,ParticipantsCard,PendingCard}.tsx`, `features/mentor-notices` (chuông). Màn hiện tại (member): `features/member-join/ui/MemberHomePage.tsx`, khung `shared/ui/member/MemberLayout`. Thiết kế cũ của member: [member-responsive-ui-prompt.md](member-responsive-ui-prompt.md).

---

Thiết kế các màn cho tính năng **"Nhóm học viên theo email + nhiều phiên chạy song song + xin vào lại"** của p-quizzz, dùng đúng **p-quizzz Design System** (token màu, typography, spacing, radius, motion, icon Lucide; component `Button`, `Card`, `ConfirmDialog`, `ErrorMessage`, `Spinner`, `StatusBadge`, `TextField`, `Icon`, `Switch`, `Kbd`, `MemberLayout`, `ScreenLayout`). Toàn bộ chữ trên UI bằng **tiếng Việt**. Giao diện **mentor và member là giao diện sáng**; màn chiếu giữ chủ đề tối hiện có.

## Bối cảnh
p-quizzz là app luyện thi chạy trên máy một mentor; học viên vào qua mạng LAN bằng trình duyệt (**phần lớn laptop/desktop, một số điện thoại**), không có tài khoản. Hiện nay chỉ có **một phiên hoạt động** tại một thời điểm, và học viên vào bằng **mã phòng 6 số + tên**.

Tính năng mới:
1. **Nhiều phiên chạy song song** (ví dụ buổi sáng nhóm A, cùng lúc nhóm B ở phòng khác). Mỗi phiên có mã phòng riêng.
2. **Nhóm (group)** = danh sách email học viên do mentor lưu, dùng lại cho nhiều phiên, nhiều đề. Khi tạo phiên mentor chọn một trong ba cách: **Tự do** (như hiện nay, chỉ nhập tên), **Dùng nhóm đã lưu**, hoặc **Nhập nhanh** (nhóm tạm gắn với phiên, lưu lại thành nhóm được sau đó).
3. Ở phiên có nhóm, học viên nhập **tên + email**; email phải nằm trong danh sách. Email là **cổng vào**, tên chỉ là **tên hiển thị tự do**.
4. **Email trùng → xin vào lại**: nếu email đã có người vào (ví dụ học viên lỡ đóng trình duyệt, hoặc có người gõ nhầm/mạo danh), học viên thấy màn confirm và gửi **yêu cầu cho mentor**; mentor thấy trên bảng điều khiển và quyết định.

## Luật nghiệp vụ ảnh hưởng thiết kế (đã quyết)
- **So khớp tên và email không phân biệt hoa thường; không bỏ dấu** (khác dấu là khác tên). Email được chuẩn hoá chữ thường, bỏ khoảng trắng đầu/cuối.
- **Group chỉ là tập email đầy đủ** (`id@domain`). Không có khái niệm "domain + id". Giao diện nhập có ô **"Domain mặc định"** chỉ như tiện ích: dòng nào chưa có `@` thì tự thêm domain đó. Dữ liệu lưu luôn là email đầy đủ.
- **Chỉ mentor thấy email.** Email **không bao giờ** xuất hiện ở: màn chiếu, bảng xếp hạng và danh sách phòng chờ phía học viên, chế độ thảo luận, màn chấm bài (kể cả khi mentor bỏ tick "Ẩn tên"), và với học viên khác. Mentor thấy email ở: bảng điều khiển phiên, yêu cầu vào lại, lịch sử phiên của mentor, màn quản lý nhóm.
- **Người trong danh sách vào thẳng** (danh sách chính là sự cho phép của mentor, không cần bấm duyệt). **Người ngoài danh sách**: mặc định **bị chặn**; mentor có thể bật cho từng phiên **"Cho người ngoài danh sách vào chờ duyệt"**, khi đó họ vào hàng chờ và mentor duyệt/từ chối như hiện nay. "Tự động duyệt người vào" hiện có chỉ dành cho phiên **Tự do**.
- **Lỗi khi từ chối không được giúp dò danh sách.** Chỉ có một thông báo cho mọi trường hợp email không hợp lệ về danh sách: "Email này không có trong danh sách của phòng. Kiểm tra lại, hoặc nhắn mentor." Không nói email nào có trong nhóm, không nói "sai đuôi email".
- **Danh sách của phiên là bản chụp lúc mở phiên.** Sửa hoặc xoá nhóm sau đó không ảnh hưởng phiên đang chạy hay lịch sử. Mentor có thể **thêm email riêng cho một phiên đang chạy** (ngoại lệ) mà không sửa nhóm gốc.
- **Mỗi email một lượt mỗi phiên.** Cùng một email có thể xuất hiện ở hai phiên song song khác nhau.
- **Xin vào lại** (áp dụng cho email trùng ở phiên nhóm, và cho tên trùng ở phiên Tự do):
  - Không bao giờ tự duyệt, kể cả khi người đang giữ chỗ đã **ngắt kết nối**. Trạng thái online/ngắt kết nối chỉ là **thông tin để mentor quyết**.
  - Mentor có **ba kết quả**: **Cho vào lại, giữ bài** (cấp quyền cho thiết bị mới, thiết bị cũ mất quyền, giữ nguyên tên hiển thị và bài làm dở); **Đây là mạo danh** (kick người đang giữ chỗ, người xin vào như người mới; **người bị kick mất lượt**, cần cảnh báo rõ); **Từ chối**.
  - Học viên F5 trong cùng trình duyệt vẫn giữ chỗ như cũ, **không** hiện màn confirm.
- Mỗi người **một lượt mỗi phiên**, không có "làm lại" (PRODUCT.md §4.4). Bảng xếp hạng mỗi phiên độc lập.

## Ràng buộc bắt buộc
- **Mentor**: thiết kế ở **1440×900**, kiểm tra **1280×720**. Mentor dùng laptop; điện thoại cho trang quản trị chỉ khi bật điều khiển từ xa nên không ưu tiên, nhưng không được vỡ ở 768px.
- **Member**: **1440×900** và **390×844** (kiểm tra 360×740). Không tràn ngang.
- Offline hoàn toàn: font, icon có sẵn trong design system.
- Trợ năng: điều khiển được bằng bàn phím trên máy tính; vùng chạm ≥ 44px trên điện thoại; focus rõ; **màu không phải tín hiệu duy nhất** (đặc biệt trạng thái online/ngắt kết nối).
- Không dùng màu hay chữ gây cảm giác "bị theo dõi" ở phía học viên: email chỉ để xác nhận thuộc lớp.

## Các màn / trạng thái cần thiết kế

### A. Mentor

1. **Tổng quan phiên** (thay `SessionListPage`): nhiều phiên đang mở cùng lúc.
   - Thẻ mỗi phiên: **tên phiên**, tên đề, loại ("Tự do" hoặc tên nhóm), trạng thái (`LOBBY`/`RUNNING`/…), **mã phòng**, số người đã vào (với phiên nhóm: "đã vào X/N"), số **yêu cầu đang chờ** (huy hiệu nổi bật).
   - Phân tách "Đang mở" và "Đã kết thúc". Trạng thái: rỗng ("Chưa có phiên nào"), đang tải, lỗi.
2. **Quản lý nhóm**: danh sách nhóm (tên, số email, lần dùng gần nhất); **tạo / sửa / xoá** nhóm.
   - Ô **dán danh sách** (hàng chục đến vài trăm dòng; chấp nhận xuống dòng hoặc dấu phẩy), ô **Domain mặc định** (tuỳ chọn).
   - **Xem trước** trước khi lưu: số hợp lệ; dòng **gộp vì trùng**; dòng **sai định dạng** (chỉ rõ dòng nào để sửa). Danh sách đã lưu cho sửa từng email, thêm, xoá.
   - Xoá nhóm: xác nhận ("Phiên đã tạo từ nhóm này không bị ảnh hưởng").
3. **Tạo phiên** (thay `CreateSessionForm`): thêm một bước **"Ai được vào?"** nhưng vẫn giữ mốc "từ đề đã duyệt đến học viên đang làm bài < 3 phút", nên chỉ thêm đúng một lựa chọn:
   - Chọn đề, **tên phiên** (gợi ý sẵn, ví dụ "Ôn tập Git – #member-0908 – 16/11").
   - **Ai được vào**: ba lựa chọn dạng phân đoạn, mặc định là lựa chọn lần trước: **Tự do** · **Nhóm đã lưu** (chọn nhóm) · **Nhập nhanh** (dán email, nhóm tạm).
   - Với nhóm: công tắc **"Cho người ngoài danh sách vào chờ duyệt"** (mặc định tắt) kèm mô tả một dòng. Với Tự do: giữ công tắc "Tự động duyệt người vào" hiện có.
   - Sau khi phiên kết thúc, nơi **"Lưu thành nhóm"** cho nhóm tạm (đề xuất vị trí ở trang chi tiết/xem lại phiên).
4. **Bảng điều khiển một phiên** (thay `SessionDetailPage`, `JoinCard`, `ParticipantsCard`, `PendingCard`):
   - Khối đầu: tên phiên, **mã phòng** và **link có sẵn mã**, nút sao chép, link màn chiếu.
   - **Danh sách người tham gia** có thêm cột **Email** (chỉ mentor) và **trạng thái kết nối**: online, hoặc **ngắt kết nối từ HH:MM** (không chỉ dựa vào màu). Hành động: **Cho vào lại** (chủ động, khi thấy ai ngắt kết nối), Kick. Đã nộp / đang làm / chưa bắt đầu như hiện nay.
   - Với phiên nhóm: **"Chưa vào"** liệt kê email trong danh sách chưa ai dùng (chỉ mentor thấy); nút **Thêm email cho phiên này**.
   - Khối **Chờ duyệt** (người ngoài danh sách, khi bật) và khối **Yêu cầu vào lại**.
5. **Chuông thông báo** (mở rộng `mentor-notices`): bây giờ theo dõi **tất cả phiên đang mở**.
   - **Mỗi thông báo gắn nhãn phiên.** Cần lọc hoặc nhóm theo phiên khi nhiều phiên cùng có thông báo.
   - Loại thông báo mới **"Yêu cầu vào lại"**, nổi bật như "chờ duyệt"/"xin sửa bài". Thẻ hiển thị: tên hiển thị và **trạng thái kết nối của người đang giữ chỗ** (online / ngắt từ HH:MM); tên hiển thị mà người xin vừa nhập; giờ xin. Ba hành động: **Cho vào lại, giữ bài** · **Đây là mạo danh** (mở `ConfirmDialog` cảnh báo "Người đang giữ chỗ sẽ bị mời ra và mất lượt làm bài") · **Từ chối**.
   - Người ngoài danh sách chờ duyệt (khi bật) cũng hiện trong chuông với email họ nhập.
   - Tiêu đề tab `(N) p-quizzz` đếm tổng các phiên.
6. **Lịch sử / xem lại phiên**: mentor thấy email từng người; thêm "Lưu thành nhóm" cho nhóm tạm.
7. **Màn chiếu** (chủ đề tối, mỗi phiên một URL): chỉ **tên hiển thị, điểm, mã phòng** như hiện nay; với phiên nhóm thêm **số "đã vào X/N"** (chỉ số đếm, **không tên người chưa vào**). **Không** hiện tên nhóm, không email.
8. Ghi chú bố cục cho **màn chấm bài** và **chế độ thảo luận**: không thay đổi, **không có email** ở bất kỳ trạng thái nào.

### B. Member (mỗi màn: bản máy tính + bản điện thoại)

1. **Vào phòng**: mã phòng 6 số (có thể điền sẵn từ link `/?room=482913`). Sau khi nhập mã hợp lệ, **form tự đổi theo loại phiên** (để học viên biết trước, không phải thử rồi mới bị báo lỗi):
   - Phiên **Tự do**: chỉ ô tên (như hiện nay).
   - Phiên **nhóm**: ô tên + ô **email** (bàn phím email trên điện thoại, tắt viết hoa tự động, không tự sửa chính tả), kèm một dòng: "Email chỉ để xác nhận bạn thuộc lớp. Chỉ mentor thấy."
   - Lỗi tại chỗ, **giữ nguyên những gì đã gõ**: "Mã phòng không đúng", "Email này không có trong danh sách của phòng…", "Email chưa đúng định dạng", "Tên đã có người dùng", "Bạn nhập sai quá nhiều lần, thử lại sau N giây". Trạng thái "Chưa có phiên nào đang mở".
2. **Confirm email/tên đã có người vào**: giải thích ngắn gọn "Đã có người vào bằng email này. Nếu đó là bạn (ví dụ lỡ đóng trình duyệt), hãy xin mentor cho vào lại." Hai nút: **"Đúng là tôi, xin mentor cho vào lại"** (chính) · **"Không phải tôi, nhập lại"**. **Không** hiện tên hay thông tin của người đang giữ chỗ.
3. **Chờ mentor cho vào lại**: đang chờ (Spinner), có nút **Huỷ yêu cầu**, tự cập nhật. Các kết quả: **được cho vào lại** (vào thẳng đúng chỗ đang làm); **bị từ chối** (kèm lối nhập lại); **hết hiệu lực** (phiên đã đóng).
4. **Thiết bị cũ bị thay thế**: "Bài của bạn đang được mở ở thiết bị khác" (khi mentor đã cho người xin vào lại).
5. **Bị chặn / chờ duyệt (người ngoài danh sách)**: chặn cứng chỉ là lỗi tại ô ở màn 1. Khi mentor bật chờ duyệt, học viên vào **màn chờ duyệt hiện có** với câu chữ phù hợp ("Bạn chưa có trong danh sách. Đang chờ mentor duyệt.").
6. Các màn còn lại (phòng chờ, làm bài, đã nộp, xem lại…) **giữ nguyên** thiết kế hiện có; chỉ cần đảm bảo **bảng xếp hạng và danh sách phòng chờ không có email**.

## Dữ liệu mẫu
- Nhóm **#member-0908**, 6 email: `philq@gmail.com`, `phiabc@gmail.com`, `phi78@gmail.com`, `phi89@gmail.com`, `linh.nguyen@company.vn`, `minh@company.vn`.
- Hai phiên song song: **"Ôn tập Git – #member-0908"** (nhóm, `RUNNING`, đã vào 5/6, 1 yêu cầu vào lại) và **"Ôn tập SQL – Tự do"** (`LOBBY`, 9 người, 2 người chờ duyệt).
- Yêu cầu vào lại: người đang giữ chỗ **"Phi"** (`phi78@gmail.com`), **ngắt kết nối từ 09:12**; người xin nhập tên **"Phi 2"**, lúc 09:14.
- Danh sách dán thử gồm 200 dòng, trong đó có dòng trùng khác hoa thường (`Phi78@Gmail.com` và `phi78@gmail.com`), dòng sai định dạng (`phi89@`), dòng chưa có `@` (`minh`, để thử Domain mặc định).

## Cần giao
- Frame cho các màn A1–A7 ở 1440×900 (thêm 1280×720 cho A4 và A5), B1–B5 ở 1440×900 và 390×844.
- Với mỗi màn: các trạng thái **rỗng, đang tải, lỗi, mất mạng** nếu áp dụng.
- Ghi chú tương tác: focus/hover, phím tắt trên màn mentor (nếu có), chuyển động (motion token, có biến thể giảm chuyển động).
- Mô tả component mới hoặc biến thể cần bổ sung vào design system (ví dụ thẻ phiên, hàng người tham gia có trạng thái kết nối, thẻ yêu cầu trong chuông, ô dán danh sách có xem trước, phân đoạn "Ai được vào?").

## Ngoài phạm vi (không thiết kế lần này)
- Tên vui ngẫu nhiên khi vào phiên (để sau).
- Xác minh email bằng thư (app chạy offline trên LAN).
- Xếp hạng hay thống kê theo email qua nhiều phiên.

## Câu hỏi mở để designer đề xuất
- Cách giúp mentor **phân biệt nhanh nhiều phiên song song** (màu nhãn, biểu tượng, thứ tự), mà không làm màu thành tín hiệu duy nhất.
- Vị trí hợp lý của "Lưu thành nhóm" để mentor khỏi quên, mà không rối bảng điều khiển.
- Cách trình bày **xem trước danh sách 200 dòng** gọn: nhóm theo hợp lệ / trùng / lỗi, hay đánh dấu ngay trong danh sách.
- Cách hiện trạng thái **ngắt kết nối** đủ nổi bật để mentor để ý, không gây hoảng khi nhiều người rớt mạng cùng lúc.
- Cách đặt ba kết quả của yêu cầu vào lại sao cho **"Đây là mạo danh" khó bấm nhầm** nhưng vẫn nhanh khi cần.
