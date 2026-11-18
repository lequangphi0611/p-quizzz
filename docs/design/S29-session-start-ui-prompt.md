# Prompt thiết kế UI: Bắt đầu phiên (hẹn giờ, sẵn sàng, đếm ngược) (S29)

> Dán nguyên phần dưới đường kẻ vào công cụ thiết kế có **p-quizzz Design System**. Business: [PRODUCT.md §7.31](../PRODUCT.md), §7.27, §7.24. Spec: [S29-session-start-modes.md](../stories/S29-session-start-modes.md). Màn hiện tại: phòng chờ member `features/member-join/ui/MemberHomePage.tsx`, màn "Bắt đầu làm bài" `features/member-exam/ui/StartScreen.tsx`, màn chiếu `features/screen/ui/ScreenPage.tsx` + `ScreenParts.tsx`, trang điều khiển phiên `features/session-admin/ui`.

---

Thiết kế **phòng chờ mới** cho học viên và cho **màn hình chiếu** của p-quizzz, cùng một thẻ điều khiển nhỏ cho mentor. Dùng đúng **p-quizzz Design System** (token màu, typography, spacing, radius, motion, icon Lucide; component `Button`, `Card`, `ConfirmDialog`, `ErrorMessage`, `Spinner`, `StatusBadge`, `TextField`, `Icon`, `Countdown`, `SegmentedControl`, `ConnectionStatus`, `MemberLayout`, `ScreenLayout`, `ScreenStage`). Toàn bộ chữ trên UI bằng **tiếng Việt**. Member: giao diện sáng. Màn chiếu: chủ đề tối hiện có.

## Bối cảnh
p-quizzz là app luyện thi chạy trên máy một mentor; học viên vào qua mạng LAN bằng trình duyệt (phần lớn laptop, một số điện thoại). Học viên nhập mã phòng + tên, vào **phòng chờ**, mentor duyệt, rồi phiên bắt đầu. Phiên có thể có **giới hạn thời gian chung cho cả phòng**, tính từ lúc phiên bắt đầu.

**Hiện tại**: phòng chờ chỉ ghi "Chờ mentor bắt đầu". Mentor bấm Bắt đầu thì học viên thấy màn "Phiên đã bắt đầu" (luật + nút **"Bắt đầu làm bài"**). Đồng hồ đã chạy từ lúc mentor bấm, nên ai không nhìn màn hình sẽ mất giờ.

**Mới**:
- Phiên bắt đầu theo **cách nào đến trước**: (1) mentor bấm **"Bắt đầu ngay"**, (2) đến **giờ hẹn** mentor đặt, (3) **mọi người trong phòng bấm "Sẵn sàng"** (chỉ khi mentor bật, kèm số người tối thiểu).
- (1) và (3) chạy qua **đếm ngược 10 giây** cho cả phòng. (2) thì không, vì đếm ngược tới giờ hẹn đã hiện sẵn. Đếm ngược 10 giây đã chạy thì không dừng, trừ khi mentor huỷ.
- **Luật làm bài hiện ở phòng chờ**. Học viên đọc rồi bấm **"Sẵn sàng"** (bấm lại để huỷ, khi chưa đếm ngược). Phòng chờ hiện **"Sẵn sàng X/Y"**.
- Phiên bắt đầu thì học viên **vào thẳng câu 1**, không còn màn "Bắt đầu làm bài". Chỉ **người vào trễ** mới thấy một màn ngắn "Phiên đã bắt đầu, bạn còn X phút".

## Ràng buộc bắt buộc
- **Ba loại đồng hồ phải nhìn khác hẳn nhau**, lướt qua không nhầm: (a) đếm ngược **tới giờ bắt đầu** (phút:giây, kèm mốc "Bắt đầu lúc 9:00"); (b) **đếm ngược 10 giây** ngay trước khi vào bài; (c) **đồng hồ làm bài** hiện có (`Countdown`, vàng ở 5 phút, đỏ ở phút cuối). Không ai được tưởng (a) là đã vào giờ làm bài.
- **Luôn nói rõ ai quyết lúc bắt đầu**, ngay dưới "Sẵn sàng X/Y": "Chờ mentor bắt đầu" · "Bắt đầu lúc 9:00 · còn 04:12" · "… hoặc khi tất cả sẵn sàng".
- **Chờ duyệt** và **chờ bắt đầu** là hai trạng thái khác nhau, phải phân biệt ngay. Người chờ duyệt chưa bấm Sẵn sàng được.
- Mọi thay đổi (đổi giờ, bỏ hẹn, bắt đầu sớm, mentor huỷ đếm ngược) hiện **thông báo dễ thấy** trên máy member và màn chiếu, không đổi lặng lẽ. Đổi nhiều lần liên tiếp không được làm màn hình nhấp nháy rối.
- **Không lộ**: member và màn chiếu chỉ thấy **con số** sẵn sàng, không tên ai chưa sẵn sàng, không ai chờ duyệt, không tên phiên/tên nhóm (chỉ tên đề), không lý do đổi giờ. Trước khi bắt đầu không hiện câu hỏi nào.
- Phiên nhóm đã có "Đã vào X/N" (theo danh sách email). "Sẵn sàng X/Y" là **dòng riêng**, Y = số người đang trong phòng. Hai phân số không được nhìn như cùng một thứ.
- Điện thoại: nút Sẵn sàng dễ bấm (≥ 44px), đồng hồ thấy được không cần cuộn; mở khoá màn hình hoặc F5 thì hiện đúng trạng thái hiện tại.
- Màn chiếu: đọc được từ cuối phòng (đếm ngược lớn), có biến thể giảm chuyển động.
- Trợ năng: thông báo cho trình đọc màn hình khi đổi giờ, khi bắt đầu đếm ngược 10 giây, khi bắt đầu; màu không phải tín hiệu duy nhất.
- Font, icon có sẵn trong design system (app chạy offline).

## Các màn / trạng thái cần thiết kế
**Member** (mỗi trạng thái: 1440×900 và 390×844)
1. Phòng chờ, **đang chờ duyệt** (chưa có nút Sẵn sàng).
2. Phòng chờ, đã duyệt, **chưa sẵn sàng**: tên đề, tên mình, khối **luật làm bài** (1 lượt; giới hạn N phút cho cả phòng nếu có; lưu liên tục; đáp án hiện sau khi đóng; có tự luận), số câu / tổng điểm, nút **"Sẵn sàng"**, "Sẵn sàng 3/5", dòng cách bắt đầu. Ba biến thể dòng đó: thủ công / có giờ hẹn (kèm đếm ngược) / có giờ hẹn + tự bắt đầu khi tất cả sẵn sàng.
3. Đã **sẵn sàng**: nút đổi thành trạng thái đã sẵn sàng + "Huỷ sẵn sàng".
4. **Thông báo** "Giờ bắt đầu đã đổi sang 9:15" · "Mentor đã bỏ giờ hẹn, chờ mentor bắt đầu" · "Mentor đã huỷ đếm ngược".
5. **Đếm ngược 10 giây** ("Bắt đầu sau 7"), hai lý do: "Mentor bắt đầu" / "Tất cả đã sẵn sàng". Biến thể **"Mentor đã bắt đầu sớm"** (trước giờ hẹn).
6. Chuyển từ đếm ngược sang **câu 1** (gợi ý chuyển động, có biến thể giảm chuyển động).
7. **Người vào trễ**: "Phiên đã bắt đầu, bạn còn 18:42" + luật thu gọn + nút "Vào làm bài".
8. **Mất kết nối** khi đang chờ / đang đếm ngược: "Đang kết nối lại…", có mạng lại thì nhảy đúng trạng thái.

**Màn hình chiếu** (1920×1080, kiểm tra 1280×720)
9. Phòng chờ: mã phòng, tên đề, người đã vào (như hiện tại), thêm **giờ bắt đầu + đếm ngược** lớn hoặc "Chờ mentor bắt đầu", "Sẵn sàng X/Y" (phiên nhóm thêm "Đã vào X/N").
10. Đếm ngược 10 giây **toàn màn**, các thông báo đổi giờ / bắt đầu sớm / huỷ.
11. Chuyển sang màn đang chạy hiện có (đồng hồ làm bài chung).

**Mentor** (1440×900, giao diện quản trị sáng, dùng lại component có sẵn, không đổi bố cục trang)
12. Thẻ **"Bắt đầu"** trên trang điều khiển phiên: hẹn giờ (chọn giờ, đổi, bỏ), công tắc "Tự bắt đầu khi tất cả sẵn sàng" + "tối thiểu N người", nút "Bắt đầu ngay", trong lúc đếm ngược có "Huỷ (còn 7 giây)". Dòng lý do khi chưa tự chạy được: "Mới 3/5 sẵn sàng" · "Đang chờ duyệt 2 người" · "Cần tối thiểu 8 người".
13. Cột/nhãn **Sẵn sàng** trong danh sách người tham gia.
14. **Hộp xác nhận** "Bắt đầu sớm hơn giờ hẹn (9:00)? Phiên giới hạn 30 phút tính từ bây giờ; ai chưa ngồi vào chỗ sẽ mất giờ làm bài."
15. Thông báo chuông: "Phòng … sắp tự bắt đầu, còn 2 người chờ duyệt" · "Giờ hẹn của phòng … đã bị bỏ vì máy khởi động lại sau giờ hẹn".

## Dữ liệu mẫu
Đề **Ôn tập Git cơ bản**, 12 câu, 20 điểm, giới hạn 30 phút, có 1 câu tự luận. Phòng có 5 người đã duyệt (An, Bình, Chi, Dũng, Hà), 3 sẵn sàng, 1 người (Hà) đang rớt mạng, 2 người chờ duyệt. Giờ hẹn 9:00, hiện tại 8:55:48. Phiên nhóm: danh sách 20 email, đã vào 18.

## Cần giao
- Frame cho các trạng thái 1–15 ở các khổ đã nêu.
- Ghi chú tương tác và chuyển động (motion token, biến thể giảm chuyển động), cách thông báo xếp chồng khi đổi nhiều lần.
- Nếu cần thêm/đổi component (vd. biến thể `Countdown` cho "tới giờ bắt đầu" và "10 giây"), mô tả props và biến thể để bổ sung vào design system.
