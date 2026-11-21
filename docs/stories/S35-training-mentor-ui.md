# S35 — UI mentor: buổi training AI

**Phụ thuộc:** S34 · **Trạng thái:** ✅ xong · **Thiết kế:** [bản thiết kế](https://claude.ai/artifact/4LDc4JsZ1p7W6jPYbxrpuR#page-dcb81aee8d83), [nhận xét + bản đồ màn hình](../design/S35-S36-training-ui-review.md), [prompt](../design/S35-S36-training-ui-prompt.md)

## Bối cảnh
Mentor tạo buổi, chiếu mã cho lớp, theo dõi ai đã kết nối, ai đang kẹt, lướt cách từng member làm, mở output khi cần, rồi Dừng thu và Kết thúc. Business: [PRODUCT.md §7.34](../PRODUCT.md) (a), (f), (g), (h).

## Phạm vi
Contract: `architecture.md` §5 "Buổi training AI" (mentor), §7 (event `training`), §8 (`/admin/trainings`, `/admin/trainings/:id`), §11.8 (Web).

- **Web** `features/training-admin/{domain,application,infrastructure,ui}` theo mẫu §12.1:
  - Trang danh sách + tạo buổi (tên).
  - Trang buổi: mã phòng + link (dùng `/api/network`), bảng member (tên, trạng thái kết nối, số prompt/lệnh/lỗi, cờ "có thể đang kẹt", lần cuối thấy), chọn một member → dòng thời gian (prompt; mỗi lệnh một dòng ✓/✗, thời gian, câu lệnh rút gọn; dòng tóm tắt; nút "Xem output" / "Xem thay đổi" tải chi tiết vào khung cuộn riêng).
  - Khi `stopped`: "Đã gỡ X/N", "Còn N máy vẫn gửi" (không liệt kê tên ở số đếm; bảng member vẫn có trạng thái từng người).
  - Nút "Dừng thu" và "Kết thúc" có hộp xác nhận; "Kết thúc" nói rõ dữ liệu bị xoá vĩnh viễn. "Mời ra" một member (xác nhận).
  - Refetch theo event `training` trên kênh mentor; dòng thời gian tải thêm bằng `after`.
  - Liên kết "Buổi training AI" trong khung `/admin/*`.
- Không có nút chiếu dữ liệu member lên màn hình chiếu (§7.34g).

## Acceptance criteria
- [x] Tạo buổi → vào trang buổi, thấy mã và link.
- [x] Member mới kết nối hiện trong ≤ 3 giây mà không tải lại trang.
- [x] Dòng thời gian không tải output cho tới khi bấm "Xem"; output dài hiển thị phần đầu, dòng "đã lược bỏ N dòng", phần cuối.
- [x] Cờ kẹt hiện ở bảng member và trên dòng thời gian.
- [x] Dừng thu → mã biến mất, hiện số đã gỡ / còn gửi; Kết thúc → trang chỉ còn tên, thời gian, số member.
- [x] Đủ trạng thái: rỗng (chưa ai vào), đang tải, lỗi, mất kết nối SSE.

## Test
- Domain + controller của `features/training-admin` bằng gateway giả.
- E2E `e2e/training-admin.spec.ts`: tạo buổi → member join qua API → gửi JSON hook giả tới ingest → thấy dòng thời gian → xem output → dừng → kết thúc; ảnh vào `docs/design/S35-assets/`.

## Giới hạn đã biết / chưa làm
- Chưa có lọc/tìm trong dòng thời gian, chưa có tóm tắt bằng AI.


## Báo cáo hoàn thành

**Đã làm** (`src/web/features/training-admin/`):
- `domain/`: nhãn kết nối bốn trạng thái (icon + chữ + kiểu viền), định dạng thời gian lệnh, nhãn công cụ (`PowerShell` → `PS`), nhóm dòng thời gian theo prompt và theo phiên Claude Code, đánh dấu chuỗi lệnh lỗi lặp (≥ 3 lần cùng `toolTarget`), sắp học viên theo tên (cố định), "Đã gỡ X/N" / "Còn N máy vẫn gửi", thông báo cho trình đọc màn hình, phím tắt, ngưỡng cuộn 80px, hiển thị clip ("… đã lược bỏ N dòng …") và dòng `-`/`+`.
- `application/`: `TrainingListController`, `TrainingController` (chọn học viên, tải dòng thời gian theo `after`, panel output/thay đổi, J/K/Esc, ẩn nội dung, ba hộp xác nhận, refetch gộp một lần chạy, cờ mất kết nối, chip "N sự kiện mới", bỏ phản hồi cũ, chặn thao tác đúp), hook `useTraining` / `useTrainingList` (SSE `onTraining` + `onResync` + poll 15 s, 5 s khi mất kết nối).
- `ui/`: danh sách + tạo buổi, trang buổi đủ trạng thái (chưa ai vào / có học viên / đã dừng / đã kết thúc), dòng thời gian, panel bên phải, hộp xác nhận. `?hv=<memberId>` giữ lựa chọn khi F5.
- Test: domain + controller bằng gateway giả, gateway HTTP (kể cả lưu "ẩn nội dung"), e2e `e2e/training-admin.spec.ts` (ảnh trong `docs/design/S35-assets/`).

**Lệch thiết kế / quyết định:**
- API chỉ phân trang tới (`after`, cũ trước), không tải được lượt cũ hơn. Nên "Tải thêm" nối thêm lượt **mới hơn** ở cuối (chỉ hiện khi vượt 10 trang × 500 sự kiện); không cần bù `scrollTop`.
- Không có tín hiệu "SSE bị ngắt" trong cổng `EventStream` (chỉ có `onResync` sau khi nối lại). Cờ "Mất kết nối với máy chủ" dựa trên việc refetch thất bại (poll mỗi 5 s khi đã mất kết nối).
- J = lệnh sau (xuống), K = lệnh trước (lên); chỉ bước qua các lệnh có output hoặc thay đổi.
- Tùy chọn "ẩn nội dung" lưu qua `TrainingAdminGateway.readHideContent/writeHideContent` (localStorage trong `HttpTrainingAdminGateway`), vì không sửa được `app/composition.ts`.
- Trang buổi đã kết thúc lấy số người từ `GET /trainings` (chi tiết buổi không có `memberCount`).
- Thứ tự học viên của server là thứ tự vào buổi; UI sắp lại theo tên.
- Thay đổi của `Write` hiển thị chữ thường, chỉ `Edit`/`MultiEdit` tô `-`/`+`.
- Cột "Lệnh" ở bảng 1440px là bố cục 2 cột ~ 1,2 : 1; khi mở panel bảng thu thành cột tên + biểu tượng.

**Đã kiểm:** `npm test` (1317 pass), `npm run typecheck`, `npm run arch:check`, e2e `E2E_PORT=3101 npx playwright test e2e/training-admin.spec.ts` (pass), xem ảnh 1440×900 và 1280×800.

**Chưa kiểm:** điện thoại; trình đọc màn hình thật (chỉ dựng `aria-live`/`role="alert"`); không đọc được từng artboard khác ngoài M12/M13 của canvas; Windows/macOS; buổi có hàng nghìn sự kiện (chưa đo hiệu năng cuộn).

## Thay đổi theo PO (2026-11-21)
- Công cụ `PowerShell` hiển thị là **PS** (`<abbr title="PowerShell">`: rê chuột và trình đọc màn hình vẫn thấy tên đầy đủ). Hàm `toolLabel` ở `domain/tool-label.ts`.
- Câu lệnh dài: **một dòng, dấu "…" ở cuối theo bề rộng cột, rê chuột hiện đủ** (thuộc tính `title`, lệnh nhiều dòng giữ xuống dòng trong tooltip). Thay cho cắt theo 90 ký tự + bấm để mở rộng (đã bỏ `shortenTarget`). Tiêu đề panel output dùng cùng cách.
- Cột tên công cụ rộng cố định 64px nên câu lệnh của mọi dòng thẳng cột; tên dài hơn (ví dụ `NotebookEdit`) cắt bằng "…" và có `title`.
- Giới hạn: tooltip gốc của trình duyệt có độ trễ ~1 giây và không hiện khi chỉ dùng bàn phím; người dùng bàn phím xem đủ lệnh ở tiêu đề panel của lệnh đó (mở bằng nút "Xem output"/"Xem thay đổi", chỉ có khi lệnh có output hoặc thay đổi). Lệnh không có output và chỉ dùng bàn phím thì chưa có cách xem đủ.
