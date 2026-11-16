# S18 — Giao diện học viên cho cả máy tính và điện thoại

**Phụ thuộc:** S10, S12, S16 · **Thiết kế:** p-quizzz Design System bản 4, `ui_kits/p-quizzz/member-v2` (từ [prompt](../design/member-responsive-ui-prompt.md)) · **Business:** [PRODUCT.md §7.18](../PRODUCT.md) · **Trạng thái:** ✅ xong (2026-11-15)

## Bối cảnh
Học viên chủ yếu dùng laptop/desktop, nhưng giao diện hiện tại là một cột 640px theo điện thoại. Làm lại toàn bộ 8 màn học viên: **máy tính** (≥ 1024px) có header 56px + sidebar danh sách câu + vùng đọc tối đa 960px; **điện thoại/tablet** (< 1024px) giữ một cột, dải câu cuộn ngang + sheet "Danh sách câu", thanh dưới cố định. Logic đã có (tự lưu, nộp bài, F5, phiên bị đóng khi đang làm, SSE) **giữ nguyên, không viết lại**.

## Phạm vi
### Bố cục chung
- `MemberLayout variant="wide"` (mới): header 56 (wordmark · tên đề · trạng thái · `headerEnd` · chip tên), `banner`, `sidebar` (296px; 264px khi < 1280), main tự cuộn, link "Đến nội dung chính". Mặc định `narrow` = như hiện tại.
- Breakpoint: < 1024 bố cục điện thoại (tablet = cột 640 căn giữa); 1024–1279 sidebar 264, lề 24; ≥ 1280 sidebar 296, lề 48. Vùng đọc ≤ 960px; đề và phương án ≤ 800px.
- Không tràn ngang ở mọi khổ; code block chỉ cuộn trong khối.

### Màn
1. **Vào phòng**: thẻ căn giữa; mã điền sẵn từ link ("Đã điền sẵn từ đường link"); lỗi tại chỗ; 429 → khoá form + **đếm ngược** theo số giây server trả. "Chưa có phiên nào đang mở" + nút "Kiểm tra lại".
2. **Phòng chờ / Chờ duyệt / Bị mời ra**: thẻ có `StatusBadge`, hộp thông tin (Đề · Tên của bạn · Đã vào phòng N người).
3. **Bắt đầu**: 3 ô số (câu · điểm · lượt làm = 1) + 3 quy tắc; máy tính có dòng mẹo phím tắt; điện thoại nút ở thanh dưới.
4. **Đang làm bài**
   - Máy tính: sidebar (Tiến độ "Đã trả lời x/n" + thanh · danh sách câu dạng hàng: số · "Câu N · Xđ" · trạng thái chữ · tóm tắt đề · **Nộp bài** ghim đáy · "Phím tắt ?"); header có trạng thái lưu; thanh dưới vùng đọc: Câu trước `←` · Câu sau `→`; số `1`–`9` ở lề trái phương án.
   - Điện thoại: dải câu 44px tự cuộn tới câu hiện tại + nút ☰ mở sheet (lưới 5 cột, tiến độ, Nộp bài); thanh dưới Trước · Sau · Nộp bài (câu cuối: Nộp bài là nút chính); ẩn thanh dưới khi bàn phím ảo mở (`visualViewport`).
   - **Phím tắt** (mọi khổ khi có bàn phím): `←`/`→` câu, `1`–`9` chọn/bật-tắt phương án, `?` bảng phím tắt, `↑`/`↓` di chuyển giữa phương án, `Esc` thoát ô nhập / đóng hộp thoại. **Tắt** khi focus ở ô nhập, khi hộp thoại/sheet mở, khi giữ Ctrl/Alt/⌘. Nộp bài **không** có phím tắt.
   - Ô tự luận cao (20 dòng máy tính / 10 dòng điện thoại), monospace, đếm dòng · ký tự; khi đang gõ hiện "Phím tắt tạm tắt khi đang gõ · Esc để thoát ô".
   - **Mất mạng** (`navigator.onLine` = false): banner "Mất kết nối — bài vẫn được giữ…", trạng thái lưu "Chờ có mạng", nút xác nhận nộp **khoá** kèm lý do.
   - Hộp nộp bài liệt kê câu chưa trả lời ("Còn 2 câu chưa trả lời (Câu 2, Câu 4)").
   - Chuyển câu: cuộn về đầu, focus tiêu đề câu.
5. **Đã nộp — chờ kết quả**: giờ nộp, điểm trắc nghiệm + "Tạm tính", ghi chú tự luận chờ chấm, "Đáp án… mở khi mentor đóng phiên".
6. **Phiên đã kết thúc**: điểm (Chính thức / Tạm tính), bảng Trắc nghiệm x/y · Tự luận (điểm khi đã chốt, "Chờ chấm" khi chưa), nút Xem lại bài; nếu bài bị **nộp tự động** do mentor đóng phiên khi đang làm → thông báo.
7. **Xem lại bài**: máy tính sidebar (điểm · công tắc "Chỉ câu chưa đúng (N)" · danh sách câu đánh dấu Đúng / Sai / Một phần / Chờ chấm, cuộn đồng bộ, bấm để nhảy); điện thoại thẻ điểm + dải câu + công tắc, cuộn dọc.
8. **Đang tải / Mất kết nối** tới máy mentor: thẻ căn giữa, nút Thử lại.

### API
- `AttemptSummary` thêm `essayScore: number | null` (tổng điểm tự luận đã chấm của lượt; `null` khi chưa chấm câu nào) để màn 6 tách điểm trắc nghiệm / tự luận. Không phải đáp án nên không ảnh hưởng chống lộ đáp án.

## Quyết định / lệch so với bản vẽ
- **Không lưu câu trả lời vào `localStorage` khi mất mạng** (ghi chú bản vẽ có). Hiện tại câu chưa lưu được giữ trong bộ nhớ và tự gửi lại khi có mạng; chỉ mất nếu tải lại trang **trong lúc** mất mạng. Lưu cục bộ cần xử lý xung đột với server → để story sau nếu gặp thực tế.
- Màn 5 không hiện "đã trả lời 4/4 câu" (server không trả số câu đã trả lời sau khi nộp); chỉ hiện giờ nộp.
- Màn 6: điểm tự luận chỉ hiện khi phiên **đã chốt**; trước đó "Chờ chấm" (khớp nhãn Tạm tính).
- Thông báo "nộp tự động" suy ra ở trình duyệt (đang làm thì phiên đóng), không thêm cờ ở server; tải lại trang sau đó thì không còn thông báo.
- Bảng xếp hạng hiện có ở màn đã nộp/kết thúc **giữ lại** (bản vẽ không vẽ nhưng là tính năng S13), đặt dưới thẻ kết quả.
- Chip phím tắt chỉ hiện khi `(hover: hover) and (pointer: fine)`.

## Ngoài phạm vi
Lưu nháp cục bộ khi mất mạng · đồng hồ đếm giờ · đổi giao diện mentor.

## Acceptance criteria
- [x] 8 màn đúng bố cục ở 1440×900, 1280×720, 1920×1080, 390×844, 360×740; không tràn ngang; code 100 ký tự không cuộn ngang ở ≥ 1280.
- [x] Phím tắt chạy; gõ trong ô tự luận không chuyển câu/chọn phương án; `Esc` thoát ô.
- [x] Tự lưu, F5, nộp bài, phiên đóng khi đang làm vẫn đúng như S12.
- [x] Mất mạng: banner + khoá nộp; có mạng lại tự lưu tiếp.
- [x] Xem lại: lọc "Chỉ câu chưa đúng", bấm danh sách nhảy đúng câu.
- [x] Không lộ đáp án trước khi đóng phiên (test quét key hiện có vẫn qua).

## Test bắt buộc
- API: `essayScore` trong `AttemptSummary` (tên khác `manualScore` để test chống lộ điểm từng câu vẫn giữ nguyên) (null → tổng sau khi chấm).
- Logic thuần (vitest): quyết định phím tắt (bỏ qua khi trong ô nhập / có modifier / hộp thoại mở), đánh dấu câu khi xem lại (đúng / sai / một phần / chờ chấm), lọc câu chưa đúng, tách số giây từ lỗi 429.
- UI: Playwright thao tác tay ở các khổ trên, ghi lại luồng.

## Ghi chú khi làm
- Thành phần mới: `shared/ui/member/` (MemberPage, SideNav, StripNav, Switch…) và `features/member-exam/ui/ExamParts.tsx` (NavSheet, Progress, ShortcutHelp…), `components/ui/Kbd.tsx`, `MemberLayout variant="wide"`, `SaveIndicator state="offline"`, `QuestionPreview pendingLabel`. Logic thuần ở `features/member-exam/domain/` (có test).
- Trường mới đặt tên `essayScore` (không phải `manualScore`) vì test chống lộ dữ liệu cấm khoá `manualScore` trong response của học viên (ở chỗ khác nó là điểm từng câu).
- Ở ≥ 1280px, dòng code ~110 ký tự vẫn cuộn ngang **trong khối code** (vùng đọc 960px vừa ~100 ký tự); trang không tràn.

## Đã thao tác tay (Playwright)
- **Máy tính 1440×900**: link `/?room=` điền sẵn mã → phòng chờ "N người" → Bắt đầu (3 ô số, mẹo phím tắt) → làm bài: sidebar 5 câu; phím `2` chọn B, `→`, `1` `2` bật 2 phương án nhiều đáp án, tiến độ 2/5; câu code dài chỉ cuộn trong khối; ô tự luận: gõ, bấm `←` và `1` vẫn ở câu 5 và chữ vào ô; `Esc` rời ô, `?` mở bảng phím tắt → mất mạng: banner + "Chờ có mạng", nút nộp khoá → có mạng lại: hộp nộp "Còn 1 câu chưa trả lời (Câu 3)" → Đã nộp (Tạm tính) → mentor đóng → Phiên đã kết thúc (Trắc nghiệm 4/5 · Tự luận Chờ chấm) → Xem lại: đánh dấu 1/1 · 2/2 · 0/1 · 1/1 · Chờ chấm; lọc "Chỉ câu chưa đúng" còn 2 thẻ.
- **1280×720**: đang làm thì mentor đóng phiên → thông báo "nộp tự động".
- **1920×1080**: bố cục giữ vùng đọc 960px.
- **Điện thoại (iPhone 13) / 360×740**: dải câu + sheet "Danh sách câu" nhảy tới câu 5, câu cuối "Nộp bài" là nút chính → nộp → sau khi chốt: Chính thức, Tự luận 0/5 → Xem lại cuộn dọc.
- Trạng thái khác: chưa có phiên (tự chuyển sang ô nhập mã khi mentor mở), chờ duyệt, bị mời ra → về trang vào phòng, tên trùng, sai mã → khoá với đếm ngược "Thử lại sau 59 → 57 giây".
- Không tràn ngang ở mọi khổ trên; không có lỗi console.
