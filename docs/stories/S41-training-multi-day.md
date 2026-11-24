# S41: Training nhiều ngày: hiện ngày và nhảy tới ngày trên dòng thời gian

**Phụ thuộc:** S35, S39, S40 · **Trạng thái:** ✅ xong (2026-11-24)

## Bối cảnh
Một buổi training kéo dài nhiều ngày và thu cả ngoài giờ học. Dòng thời gian của mentor chỉ hiện giờ:phút nên không biết prompt nào của ngày nào. Business: [PRODUCT.md §7.36](../PRODUCT.md) (a)–(e).

## Phạm vi
**Không đổi contract** (`architecture.md`): không đổi API, schema hay event. Toàn bộ dữ liệu cần đã có (`TrainingEventRow.receivedAt`). Ngày tính theo giờ địa phương của trình duyệt (web) và của tiến trình server (báo cáo); cả hai chạy trên máy mentor.

- **Web mentor** (`src/web/features/training-admin`)
  - Domain thuần (ví dụ `domain/days.ts`, kèm test):
    - khoá ngày của một mốc thời gian theo giờ địa phương;
    - nhãn ngày đầy đủ tiếng Việt: `Thứ Hai`…`Thứ Bảy`, `Chủ Nhật` + `dd/mm/yyyy`, ví dụ `Thứ Ba, 24/11/2026`;
    - nhãn ngắn cho ô chọn: `Thứ Ba 24/11`;
    - danh sách ngày từ các sự kiện đã tải: mới nhất trước, mỗi ngày kèm số prompt.
  - `buildTimeline` (`domain/timeline.ts`) chèn mục `{ kind: 'day', key, dayKey, startedAt }` trước mục đầu tiên của mỗi ngày (kể cả ngày đầu tiên).
    - Ngày của một lượt là ngày của prompt. Lượt "Trước prompt đầu tiên" lấy ngày của sự kiện đầu tiên của nó.
    - Các công cụ trong một lượt không bao giờ tách lượt ra, dù chạy sau 0 giờ.
    - Khi dải ngày và dải phiên Claude Code rơi cùng chỗ thì dải ngày đứng trước.
  - `Timeline.tsx`:
    - vẽ dải ngày: `role="separator"`, `aria-label` là nhãn đầy đủ, `id` để cuộn tới;
    - dải phiên giữ `mở lúc 14:30` (chỉ giờ): dải ngày luôn nằm ngay trên nó (sửa sau review vòng 1);
    - khi có ≥ 2 ngày, đầu dòng thời gian có ô chọn ngày (dùng component có sẵn trong `src/web/shared/ui` nếu có, không thì `<select>` theo style hiện có), nhãn "Đi tới ngày", mỗi lựa chọn dạng `Thứ Ba 24/11 · 12 prompt`;
    - chọn một ngày thì cuộn tới dải của ngày đó; không lọc hay ẩn sự kiện nào; khi mở trang vẫn cuộn xuống cuối như cũ.
  - Ẩn ô chọn ngày khi nội dung đang ẩn (phím `H`), khi đang tải hoặc lỗi, và khi chỉ có 1 ngày.
  - `TurnDetail.tsx`: giờ của prompt hiện kèm ngày, dạng `24/11 14:30`.
- **Server báo cáo** (`src/server/domain/training/report.ts`): mọi mốc giờ trong file Markdown (ví dụ đã đánh dấu, …) ghi `dd/mm HH:MM` thay cho `HH:MM`. Cập nhật test báo cáo.
- **Web member, màn đồng ý** (`src/web/features/training-member/domain/consent-copy.ts`): thêm một mục, đặt trước mục xoá dữ liệu, nói rằng buổi có thể kéo dài nhiều ngày, và mọi prompt, lệnh trong thư mục bài tập đều được gửi, kể cả ngoài giờ học, cho tới khi mentor dừng thu hoặc bạn dừng gửi. Dùng icon có sẵn trong `Icon`. Sửa test hoặc ảnh e2e bị ảnh hưởng.

## Ngoài phạm vi
- Thanh lọc (theo ngày, lệnh lỗi, cờ, đã đánh dấu, tìm chữ).
- Xem prompt của cả lớp theo ngày.
- Xuất báo cáo theo ngày.
- Đổi cách phân trang hay API dòng thời gian.

## Acceptance criteria
- [x] Dòng thời gian của sự kiện trải trên 2 ngày trở lên có đúng một dải ngày cho mỗi ngày, theo thứ tự thời gian, có dải trước mục đầu tiên. Dòng thời gian chỉ có một ngày cũng có một dải.
- [x] Prompt lúc 23:58 có lệnh chạy lúc 00:03 hôm sau: cả lượt nằm dưới ngày của prompt. Dải ngày hôm sau chỉ xuất hiện trước lượt kế tiếp.
- [x] Nhãn ngày đúng thứ tiếng Việt, kể cả Chủ Nhật, và đúng định dạng `dd/mm/yyyy` (có số 0 đứng đầu).
- [x] Dải phiên Claude Code chỉ ghi giờ `mở lúc HH:MM` (dải ngày luôn nằm ngay trên nó; sửa sau review vòng 1).
- [x] Ô "Đi tới ngày" chỉ hiện khi có ≥ 2 ngày. Liệt kê ngày mới nhất trước, kèm số prompt đúng. Chọn một ngày thì dải ngày đó vào khung nhìn.
- [x] Ô chọn ngày bị ẩn khi nội dung đang ẩn. Không có nội dung prompt nào lọt ra khi ẩn.
- [x] Ô chi tiết lệnh hiện ngày kèm giờ của prompt.
- [x] Báo cáo Markdown ghi `dd/mm HH:MM` cho mọi mốc giờ.
- [x] Màn đồng ý của member có mục mới về nhiều ngày / ngoài giờ học.
- [x] Không đổi API, schema, event. `npm run typecheck`, `npm test` (gồm `arch:check`) pass.

## Test
- Domain web: `days.test.ts` (khoá ngày, nhãn, Chủ Nhật, số 0 đứng đầu, đếm prompt theo ngày, thứ tự mới nhất trước). `timeline.test.ts` thêm các ca: nhiều ngày, qua nửa đêm trong một lượt, dải ngày đứng trước dải phiên, lượt "Trước prompt đầu tiên". Dựng mốc thời gian bằng `new Date(y, m, d, h, min)` (giờ địa phương) để test không phụ thuộc múi giờ máy chạy.
- Server: test báo cáo có định dạng `dd/mm HH:MM`.
- E2E: mở rộng `e2e/training-admin.spec.ts` (hoặc file mới `e2e/training-multi-day.spec.ts`).
  - Server luôn ghi `receivedAt` là thời điểm nhận, nên để có sự kiện của ngày cũ, hãy giả lập đồng hồ trình duyệt bằng `page.clock` nếu đủ. Nếu không đủ thì ghi rõ trong báo cáo rằng phần nhiều ngày chỉ được phủ bằng unit test.
  - Tối thiểu: có dải ngày, có ngày trong ô chi tiết lệnh, màn đồng ý có mục mới.
  - Ảnh chụp vào `docs/design/S41-assets/`.

## Module bị chạm
`src/web/features/training-admin/{domain,ui}`, `src/web/features/training-member/domain/consent-copy.ts`, `src/server/domain/training/report.ts`, test tương ứng, `e2e/`.

## Đã làm (ghi chú)
- `domain/days.ts` (khoá ngày, nhãn đầy đủ/ngắn, `dayAndClock`, `listDays`). Ngày của một lượt là ngày của sự kiện đầu lượt; `listDays` theo cùng quy tắc nên số prompt khớp với dải ngày.
- `buildTimeline` chèn dải ngày trước lượt đầu của mỗi ngày và trước dải phiên mở cùng lượt đó (dải phiên được giữ lại đến khi lượt mở).
- Ô "Đi tới ngày" là `<select>` (shared/ui chưa có Select), đặt dưới đầu dòng thời gian, có placeholder "Chọn ngày…"; chọn xong chỉ cuộn.
- Báo cáo: `stamp` thành `dd/mm HH:MM`; dòng "Xuất lúc" giữ `dd/mm/yyyy HH:MM`.
- Màn đồng ý: thêm mục "Buổi có thể kéo dài nhiều ngày." (icon `calendar`) trước mục xoá dữ liệu.
- E2E `e2e/training-multi-day.spec.ts` (tên bắt đầu bằng `training-` để chạy sau `training-admin.spec.ts`, vì các spec dùng chung một server): server luôn ghi `receivedAt` là giờ nhận và `page.clock` không đổi được dữ liệu đó, nên spec dịch `receivedAt` trong câu trả lời của `/members/:id/events` bằng `page.route`. Phủ: 3 dải ngày, ô chọn (thứ tự, số prompt, cuộn), ngày trong ô chi tiết, ẩn nội dung, màn đồng ý. Ảnh: `docs/design/S41-assets/`.
