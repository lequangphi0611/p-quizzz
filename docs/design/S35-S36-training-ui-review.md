# Bản thiết kế + nhận xét: Buổi training AI (S35, S36)

> **Bản thiết kế:** https://claude.ai/artifact/4LDc4JsZ1p7W6jPYbxrpuR#page-dcb81aee8d83 (canvas "p-quizzz · Buổi training AI — bảng thiết kế", dùng p-quizzz Design System).
> Prompt: [S35-S36-training-ui-prompt.md](S35-S36-training-ui-prompt.md). Spec: [S35](../stories/S35-training-mentor-ui.md), [S36](../stories/S36-training-member-ui.md). Business: [PRODUCT.md §7.34](../PRODUCT.md).

## 1. Bản đồ màn hình (tên artboard trên canvas)

Mở một artboard: thêm `#artboard-<tên không có .dc.html>` vào cuối link, ví dụ `…/4LDc4JsZ1p7W6jPYbxrpuR#artboard-M13-dong-thoi-gian`.

| Prompt | Artboard | Ghi chú |
|---|---|---|
| Component mới | `Main` | Các component đề xuất bổ sung |
| 1 Đồng ý | `S01-dong-y`, `S01b-ten-trung`, `P01-dong-y` (điện thoại) | |
| 2 Chọn thư mục | `S02-chon-thu-muc` | |
| 3 Thêm cấu hình | `S03-nho-claude` (A), `S03b-tu-ghep` (B) | |
| 4 Chờ tín hiệu | `S04-cho-tin-hieu`, `S04b-chua-thay` | |
| 5 Đang thu | `S05-dang-thu`, `P05-dang-thu` | |
| 6 Rút lại | `S06-rut-lai` | |
| 7 Gỡ kết nối | `S07-go-ket-noi`, `P07-go-ket-noi` | |
| 8 Kiểm tra gỡ | `S08-kiem-tra`, `S08b-da-go`, `S08c-van-con` | |
| 9 Kết thúc / mất kết nối | `S09-da-ket-thuc`, `S09b-mat-ket-noi`, `P09-da-ket-thuc`, `P09b-mat-ket-noi` | |
| 10 Danh sách | `M10-danh-sach`, `M10b-rong` | |
| 11 Chưa ai vào | `M11-chua-ai` | Để chiếu mã |
| 12 Có học viên | `M12-co-hoc-vien`, `M12b-an-noi-dung`, `M12c-1280` | |
| 13 Dòng thời gian | `M13-dong-thoi-gian` | Màn quan trọng nhất |
| 14 Output / thay đổi | `M14-output`, `M14b-thay-doi`, `M14c-dang-tai`, `M14d-loi` | Panel bên phải |
| 15–19 | `M15-xac-nhan-dung`, `M16-da-dung`, `M17-xac-nhan-ket-thuc`, `M18-da-ket-thuc`, `M19-moi-ra` | |

## 2. Quyết định thiết kế (theo ghi chú của designer)

1. **Xem output = panel bên phải**, không mở rộng tại chỗ (mở tại chỗ đẩy dòng thời gian, mentor mất chỗ đang đọc). Khi panel mở, bảng học viên thu thành cột tên hẹp. `J`/`K` sang lệnh trước/sau, `Esc` đóng và trả focus.
2. **Bảng học viên sắp theo tên, cố định.** Không có cột hay nút sắp theo số lỗi. Cờ "Có thể đang kẹt" = chip vàng nhạt + icon cờ, không dùng đỏ.
3. **Trạng thái kết nối** phân biệt bằng icon + chữ + kiểu viền: chưa nhận = viền đứt; đã nhận = nền xanh + icon wifi; đã gỡ = nền xám + dấu tích; vẫn gửi sau khi dừng = nền vàng + tam giác.
4. **Dòng thời gian cũ → mới** (mới nhất ở dưới, như log); lượt cũ tải thêm ở đầu, giữ vị trí cuộn bằng cách bù `scrollTop`.
5. Học viên: cột 640px cho màn đồng ý/trạng thái, 800px cho các bước cài.
6. **Màn đồng ý:** hai nút cùng cỡ, cùng hàng; "Đồng ý" chỉ bật khi đã tick; "Không tham gia" luôn bật.
7. **Dừng thu = nút viền** (không xoá dữ liệu); **Kết thúc = nút đỏ** (xoá vĩnh viễn).

Tương tác:
- Chọn học viên bằng bấm hoặc `↑`/`↓` + `Enter`; URL `?hv=<học viên>` để F5 giữ lựa chọn.
- Sự kiện mới: đang ở cuối (≤ 80px) thì bám đáy, không thì hiện chip "N sự kiện mới ↓".
- **Ẩn nội dung:** phím `H` (khi không gõ trong ô nhập) hoặc nút đầu trang; nhớ trong trình duyệt của mentor. Đề xuất: bật "Chiếu mã" thì tự ẩn.
- Trình đọc màn hình: `aria-live="polite"` cho "Đã nhận tín hiệu" và kết quả kiểm tra gỡ, `role="alert"` khi dừng thu; bảng mentor không live.
- Nút trên điện thoại ≥ 48px.

## 3. Lệch so với contract: khi code, theo contract (đã kiểm bằng spike)

| Designer viết | Contract / spike | Làm theo |
|---|---|---|
| Chưa chắc có `PostToolUseFailure`, `duration_ms` | Spike đã thấy cả hai ([spike](../spikes/claude-code-hooks.md) §3) | Contract |
| Hook timeout 2 giây | `timeout: 1` (đo: chậm thêm khoảng 0,6 giây mỗi lượt) | Contract |
| Token trong URL (`/t/b7Kq2m`) | Token qua header `X-Training-Token` (đã thử chạy được) | Contract |
| Sau Dừng thu trả 200 rỗng, để Claude Code không hiện thông báo lạ | Trả 200 kèm `systemMessage` nhắc gỡ (§5). Chưa xác nhận lời nhắc có hiện ra không: checklist máy thật mục 6 | Contract, xem lại sau checklist |
| Design system thiếu `Kbd`, `SegmentedControl`, `ConnectionStatus`, `RulesCard`, `Switch`, `tableStyles` nên dựng lại bằng markup | Các component này **đã có trong code** (`src/web/shared/ui`), chỉ thiếu trong bản design system | Dùng component có sẵn trong code |

Thông tin mới từ designer, **chưa kiểm chứng**: máy do công ty quản lý có thể chặn hook HTTP bằng cài đặt `allowedHttpHookUrls`. Đã thêm vào gợi ý "chưa thấy tín hiệu" (màn `S04b-chua-thay`) và nên kiểm trong checklist máy thật.

## 4. Phản biện của designer: PO đã quyết hay còn chờ

1. **Output của công cụ Read chính là nội dung file** (kể cả `.env`). Designer đề xuất không lưu output của Read, chỉ lưu tên file + số dòng; màn đồng ý đang viết theo đề xuất này. → **Chờ PO quyết.** Nếu đồng ý thì sửa §7.34(c) và `filterHookEvent` (§11.8).
2. **"Không gửi việc làm ngoài thư mục bài tập" là không chính xác**: Claude mở trong thư mục bài tập vẫn có thể chạy lệnh đụng chỗ khác (ví dụ `cat ~/.ssh/...`), và lệnh đó vẫn bị gửi. Câu đúng là "phiên Claude Code mở ở thư mục khác thì không gửi", kèm một dòng lưu ý. → Đã sửa §7.34(i) (2026-11-20).
3. **"Đã gỡ" chỉ là tự khai báo có kiểm tra, không phải bằng chứng**: không nhận được gì cũng xảy ra khi học viên quên gõ prompt hoặc máy mất mạng. → Đã ghi vào giới hạn đã biết §7.34(i).
4. **Mentor vẫn suy ra được số người từ chối** (lớp 20 người mà bảng có 17), chỉ không biết là ai. → Đã ghi vào giới hạn đã biết §7.34(i).
5. Thiếu component trong design system: xem mục 3.
6. Dữ liệu mẫu: designer thêm một lần chạy `npm test` cho khớp "lỗi 4 lần". Không ảnh hưởng.
