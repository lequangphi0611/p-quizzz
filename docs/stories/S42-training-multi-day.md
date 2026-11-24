# S42: Training nhiều ngày: nhóm theo ngày trên dòng thời gian

**Phụ thuộc:** S35, S39, S40 · **Trạng thái:** ✅ (2026-11-24, vòng 3)

## Bối cảnh
Một buổi training kéo dài nhiều ngày và thu cả ngoài giờ học. Dòng thời gian của mentor chỉ hiện giờ:phút nên không biết prompt nào của ngày nào. Business: [PRODUCT.md §7.37](../PRODUCT.md) (a)–(e).

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
  - Ảnh chụp vào `docs/design/S42-assets/`.

## Module bị chạm
`src/web/features/training-admin/{domain,ui}`, `src/web/features/training-member/domain/consent-copy.ts`, `src/server/domain/training/report.ts`, test tương ứng, `e2e/`.

## Đã làm (ghi chú)
- `domain/days.ts` (khoá ngày, nhãn đầy đủ/ngắn, `dayAndClock`, `listDays`). Ngày của một lượt là ngày của sự kiện đầu lượt; `listDays` theo cùng quy tắc nên số prompt khớp với dải ngày.
- `buildTimeline` chèn dải ngày trước lượt đầu của mỗi ngày và trước dải phiên mở cùng lượt đó (dải phiên được giữ lại đến khi lượt mở).
- Ô "Đi tới ngày" là `<select>` (shared/ui chưa có Select), đặt dưới đầu dòng thời gian, có placeholder "Chọn ngày…"; chọn xong chỉ cuộn.
- Báo cáo: `stamp` thành `dd/mm HH:MM`; dòng "Xuất lúc" giữ `dd/mm/yyyy HH:MM`.
- Màn đồng ý: mục "Buổi có thể kéo dài nhiều ngày." gộp với mục cùng tên đến từ main (icon `clock`, sau mục xoá dữ liệu) khi merge; thêm ý "kể cả ngoài giờ học".
- E2E `e2e/training-multi-day.spec.ts` (tên bắt đầu bằng `training-` để chạy sau `training-admin.spec.ts`, vì các spec dùng chung một server): server luôn ghi `receivedAt` là giờ nhận và `page.clock` không đổi được dữ liệu đó, nên spec dịch `receivedAt` trong câu trả lời của `/members/:id/events` bằng `page.route`. Phủ: 3 dải ngày, ô chọn (thứ tự, số prompt, cuộn), ngày trong ô chi tiết, ẩn nội dung, màn đồng ý. Ảnh: `docs/design/S42-assets/`.

## Vòng 2: nhóm theo ngày, ngày mới nhất ở trên, thu gọn (PO đổi 2026-11-24)
PO xem ảnh vòng 1 và đổi cách hiển thị. Business: [PRODUCT.md §7.37](../PRODUCT.md) (a), (b), (e) bản mới. Phần báo cáo Markdown, ô chi tiết lệnh có ngày và màn đồng ý của vòng 1 **giữ nguyên**. Vẫn **không đổi contract**.

### Phạm vi
- **Nhóm theo ngày:** dòng thời gian thành danh sách nhóm ngày, **ngày mới nhất ở trên**. Trong một nhóm, các lượt và dải phiên Claude Code giữ thứ tự **cũ → mới** như hiện nay, cùng quy tắc ngày của vòng 1 (lượt thuộc ngày của prompt; lệnh sau 0 giờ không tách lượt; lượt "Trước prompt đầu tiên" theo ngày của sự kiện đầu). Cách làm gợi ý: domain thuần gom kết quả `buildTimeline` (hoặc thay `kind: 'day'`) thành `DayGroup[] = { dayKey, startedAt, items, prompts, commands, failed }`, mới nhất trước; số lệnh và số lỗi đếm như `Detail` hiện có (chỉ sự kiện `kind === 'tool'`). Số prompt và các dải ngày phải đến từ **cùng một** phép gom, không tính hai nơi.
- **Tiêu đề nhóm** là một nút (`<button aria-expanded>`, có `aria-controls`) ghi nhãn ngày đầy đủ và tóm tắt: `Thứ Ba, 24/11/2026 · 5 prompt · 12 lệnh · 2 lỗi` (bỏ phần lỗi khi bằng 0), kèm icon mũi tên mở/thu. Giữ được dùng bằng bàn phím.
- **Mặc định:** ≥ 2 ngày → chỉ mở ngày mới nhất; 1 ngày → mở. Chọn member khác → về mặc định. Sang ngày mới khi đang xem (sự kiện mới thuộc ngày chưa có) → ngày mới tự mở, các ngày khác giữ nguyên.
- **"Mở tất cả / Thu tất cả"**: một nút trong đầu dòng thời gian, chỉ hiện khi ≥ 2 ngày; chữ đổi theo trạng thái (còn ngày thu gọn → "Mở tất cả", không thì "Thu tất cả"). Theo kiểu nút gập/mở đã có ở S40.
- **Tự mở khi nhảy tới:** chip cờ (`jumpToFlag`), J/K, mở chi tiết lượt (`openTurn`), hay bất kỳ chỗ nào đặt `focusId`/`turnKey` vào sự kiện trong ngày đang thu gọn → mở ngày đó rồi mới cuộn tới.
- **Cuộn và sự kiện mới:** khi mở dòng thời gian, hiện **sự kiện mới nhất** (cuối nhóm ngày mới nhất) trong khung nhìn. "Đang theo dõi" giờ nghĩa là sự kiện mới nhất đang nằm trong (hoặc gần) khung nhìn, thay cho "đang ở cuối danh sách": khi đang theo dõi thì sự kiện mới vẫn giữ trong khung nhìn; không thì hiện nút "N sự kiện mới" để nhảy tới (và mở nhóm của nó nếu đang thu). Sửa `reportScroll`/`jumpToBottom`/`isNearBottom` và tên gọi cho đúng nghĩa mới; giữ test hành vi cũ tương ứng.
- **"Tải thêm"** (sự kiện mới hơn giới hạn đã tải) chuyển lên **trên cùng**, trên nhóm ngày mới nhất, ghi "Còn sự kiện mới hơn chưa tải".
- **Bỏ ô "Đi tới ngày"** cùng `listDays` và mọi code chỉ dùng cho nó (giữ hàm nhãn nào còn dùng).
- **Ẩn nội dung (H):** không hiện tiêu đề ngày, tóm tắt hay nút mở/thu (như phần còn lại của dòng thời gian khi ẩn).
- **Ảnh** `docs/design/S42-assets/` **chụp lại toàn bộ**, thay các ảnh cũ. Dữ liệu ảnh phải có **giờ khác nhau** giữa các prompt (không phải cùng một giờ ở mọi ngày) và có một lượt qua nửa đêm. Gồm: (1) mặc định nhiều ngày: ngày mới nhất mở, các ngày khác thu gọn; (2) sau "Mở tất cả"; (3) ô chi tiết lệnh có ngày; (4) màn đồng ý của member với **mục "Buổi có thể kéo dài nhiều ngày" nằm trong ảnh** (chụp phần tử hoặc cuộn tới); (5) khung hẹp ~800px.

### Acceptance criteria (vòng 2)
- [x] Nhóm ngày xếp mới nhất trước; trong nhóm, lượt xếp cũ → mới. Lượt qua nửa đêm nằm trọn trong nhóm ngày của prompt.
- [x] Tiêu đề nhóm đúng nhãn và tóm tắt (prompt, lệnh, lỗi; bỏ lỗi khi 0), số liệu khớp các lượt trong nhóm.
- [x] ≥ 2 ngày: mặc định chỉ ngày mới nhất mở; 1 ngày: mở. Chọn member khác về mặc định.
- [x] Bấm tiêu đề mở/thu đúng ngày đó; `aria-expanded` đúng; dùng được bằng bàn phím.
- [x] "Mở tất cả / Thu tất cả" chỉ hiện khi ≥ 2 ngày và làm đúng việc.
- [x] Chip cờ / J/K / mở chi tiết lượt tới sự kiện trong ngày thu gọn thì ngày đó tự mở và sự kiện vào khung nhìn.
- [x] Mở dòng thời gian thấy sự kiện mới nhất. Đang theo dõi thì sự kiện mới vẫn trong khung nhìn; đang xem chỗ khác thì có "N sự kiện mới", bấm vào thì tới sự kiện mới nhất.
- [x] Sự kiện của ngày mới (đang xem) tạo nhóm mới ở trên cùng, tự mở; trạng thái các nhóm khác giữ nguyên.
- [x] "Tải thêm" nằm trên cùng khi còn sự kiện chưa tải.
- [x] Không còn ô "Đi tới ngày" và code thừa của nó.
- [x] Ẩn nội dung thì không lộ prompt, tiêu đề ngày hay tóm tắt.
- [x] Ảnh `docs/design/S42-assets/` được chụp lại theo danh sách trên; ảnh cũ không còn dùng thì xoá.
- [x] Không đổi API, schema, event. `npm run typecheck`, `npm test` pass; toàn bộ `npm run e2e` không có lỗi mới (lỗi có sẵn `s26-ai-grading` khi chạy cả bộ đã biết, xem PR #45).

### Test (vòng 2)
- Domain: gom nhóm ngày (thứ tự, tóm tắt, qua nửa đêm, một ngày, phiên Claude Code trải qua hai ngày); trạng thái mở/thu mặc định và khi có ngày mới (nếu tách thành hàm thuần ở domain/application).
- Controller: tự mở ngày khi nhảy tới sự kiện; quy tắc "đang theo dõi" mới; chọn member khác về mặc định.
- E2E `e2e/training-multi-day.spec.ts`: mặc định thu gọn, mở/thu một ngày, "Mở tất cả", chip cờ hoặc chi tiết lượt mở ngày thu gọn (nếu dựng được dữ liệu), ẩn nội dung, màn đồng ý; chụp ảnh như trên.

### Đã làm (vòng 2)
- Domain `domain/day-groups.ts`: `groupByDay` gom kết quả `buildTimeline` (dải `day` vẫn là mốc cắt) thành `DayGroup[]` mới nhất trước, kèm số prompt/lệnh/lỗi; `dayGroupSummary`, `dayKeyOfEvent`/`dayKeyOfTurn`, `reconcileOpenDays` (mặc định + ngày mới tự mở), `withDayOpen`. Bỏ `listDays`, `dayShortLabel`, `dayElementId` và ô "Đi tới ngày".
- Controller: `TimelineState.openDays/knownDays`, `toggleDay`, `setAllDays`; `jumpToFlag`, `openTurn`, `step` tự mở ngày chứa sự kiện. Đổi tên cho đúng nghĩa: `reportScroll` thành `reportFollowing`, `jumpToBottom` thành `jumpToLatest`, `stickToken` thành `followToken`; `isNearBottom` thành `isLatestInView` (sự kiện mới nhất nằm cuối nhóm ngày đầu tiên, đánh dấu bằng một phần tử cao 0 `#timeline-latest`).
- `Timeline.tsx`: tiêu đề nhóm là `<button aria-expanded aria-controls>`, nút "Mở tất cả / Thu tất cả" (≥ 2 ngày), "Tải thêm" lên trên cùng; ẩn nội dung thì không có gì trong số đó.
- E2E `e2e/training-multi-day.spec.ts` viết lại (giờ khác nhau giữa các prompt, một lượt qua nửa đêm, chip cờ mở ngày thu gọn); ảnh chụp lại trong `docs/design/S42-assets/` (1 mặc định, 2 mở tất cả, 3 chi tiết lượt, 4 màn đồng ý, 5 khung 800px).

## Vòng 3: áp thiết kế của designer (PO duyệt 2026-11-24)
PO thấy UI vòng 2 không hài hoà và nhờ designer ([prompt](../design/S42-training-day-groups-ui-prompt.md)). Kết quả:
- Canvas gốc: https://claude.ai/artifact/VweyUbGHM2TvdB3hc1GpSL
- Bản chép trong repo: [`docs/design/S42-design/`](../design/S42-design/).
  - `Spec.dc.html` là **spec cho dev**: số đo, token, tương tác, component đề xuất.
  - `Screen.dc.html` là màn hình dùng chung cho mọi frame. Các frame chỉ khác nhau ở `variant`: `default`, `all`, `single`, `flag`, `new`, `stuck`, `more`, `hidden`, `loading`, `error`.

Hai file là HTML của công cụ thiết kế, không chạy được trong app. Đọc chúng để lấy cấu trúc, số đo và token. Token trong thiết kế (`--ink-*`, `--brand-*`, `--wrong-600`, `--surface-page`, `--focus-ring`, `--dur-fast`, `--ease-standard`, `--shadow-raised`, …) là token của design system; dùng token tương ứng trong `src/web` (tìm trong CSS hiện có). Thiếu token nào thì báo, đừng tự đặt giá trị mới. Hành vi vòng 2 giữ nguyên, trừ các điểm dưới. Business: [PRODUCT.md §7.37](../PRODUCT.md) (b) bản mới.

### Phạm vi
- **Tiêu đề ngày (`DayGroupHeader`)** theo Spec:
  - Không còn là thẻ. Chữ trên nền khung, hàng tối thiểu 44px, chevron 16 trong ô 28×28.
  - Nhãn ngày 700 15px `ink-900`. Huy hiệu **"Hôm nay"** cho ngày hôm nay.
  - Tóm tắt 400 13px `ink-600`, số dạng tabular. Riêng con số lỗi 600 `wrong-600`; bỏ "· N lỗi" khi bằng 0.
  - Hover nền `ink-100`; focus dùng `focus-ring`.
  - Ngày đang thu giữ màu chữ và **hiện chip cờ của ngày đó** bên phải. Chip là nút riêng cạnh nút tiêu đề, không lồng vào trong; bấm thì như chip cờ hiện có (mở ngày, tới sự kiện căn cứ).
  - Cột hẹp (≤ ~560px): tóm tắt xuống dòng; chip xuống dòng thứ ba, thụt 38px.
- **Đường ray và khoảng cách**:
  - Nội dung một ngày thụt 36px (13 + ray 2px `ink-200` + 21); ray chạy dưới tâm chevron.
  - Prompt ↔ prompt 8px; prompt → dải phiên 12px; dải phiên → prompt 12px.
  - Giữa các ngày có đường kẻ 1px `ink-200` chạy hết chiều ngang. Các ngày đang thu liền nhau thành danh sách kẻ dòng, không để khoảng trống.
  - Khung cuộn đệm 12px trên, 16px hai bên.
- **Dải phiên (`SessionMarker`)**:
  - Điểm mốc 12px trên ray; chữ thường căn trái: "Phiên Claude Code 2" (600 12px `ink-800`) + " · mở lúc 09:55" (400 `ink-600`); vạch đứt `ink-300` tới mép phải.
  - **Phiên kéo qua 0 giờ**: đầu ngày sau lặp dải "Phiên Claude Code N · tiếp từ dd/mm". Số phiên đánh theo cả buổi.
- **Chỉ một ngày**: dùng **nhãn nhẹ** (biến thể `light`, không phải nút, không có chevron/ray thu gọn), ví dụ "Thứ Ba, 24/11/2026 · Hôm nay" + tóm tắt. Theo frame `single`.
- **"Mở tất cả / Thu tất cả"**: chuyển lên **hàng thông tin học viên** (frame `default`), `Button` ghost sm icon `list`. Bỏ hàng riêng hiện có. Ẩn khi chỉ một ngày hoặc khi đang ẩn nội dung.
- **Tiêu đề ngày dính**:
  - Chỉ tiêu đề của ngày **đang mở** dính ở đầu khung; ngày sau đẩy ngày trước lên. Dải phiên không dính.
  - Bóng và đường kẻ dưới chỉ hiện khi đang dính.
  - Bấm tiêu đề đang dính để thu thì cuộn sao cho tiêu đề đó nằm ở đỉnh khung.
- **Mở/thu**: không làm hiệu ứng chiều cao. Chevron xoay trong `dur-fast` / `ease-standard`; nội dung hiện bằng hiệu ứng fade có sẵn (nếu có), và tôn trọng giảm chuyển động. `aria-expanded` + `aria-controls`; vùng nội dung `role="region"` `aria-labelledby`. Thứ tự Tab: tiêu đề ngày → chip cờ của ngày → các prompt.
- **Giữ vị trí đọc**:
  - Trước mỗi thay đổi DOM (sự kiện mới, mở/thu một ngày phía trên, Tải thêm), lưu phần tử đầu tiên đang thấy và khoảng lệch của nó; sau khi đổi thì đặt lại `scrollTop` để phần tử đó đứng yên. `overflow-anchor` chỉ là lớp dự phòng.
  - Ngoại lệ: đang theo dõi (quy tắc vòng 2) thì đi theo sự kiện mới.
- **Chip "N sự kiện mới"**: đặt ở **mép phía có sự kiện** (sự kiện ở trên khung nhìn thì chip ở mép trên, mũi tên hướng lên; ở dưới thì mép dưới, mũi tên xuống). Nền `ink-900`, bóng `shadow-raised`. Bấm thì mở ngày (nếu thu), cuộn tới, tô kiểu focus rồi nhạt dần.
- **"Tải thêm"** chuyển xuống **cuối nhóm ngày mới nhất**, ngay sau prompt cuối của ngày đó. Ngày đó đang thu thì vẫn hiện nút ở vị trí tương ứng (dưới tiêu đề).
- **Ẩn nội dung**: thay cả khung bằng thông báo như hiện nay, nhưng **giữ trạng thái mở/thu và vị trí cuộn**, để bật lại thì về đúng chỗ.
- **Đang tải / lỗi tải**: khớp frame `loading` / `error`.
- **Component**: tách `DayGroupHeader`, `SessionMarker` (và `CollapsibleSection` nếu tiện) thành component trong `features/training-admin/ui`. Không thêm vào `shared/ui` trừ khi đã có chỗ dùng thứ hai.
- **Ảnh** `docs/design/S42-assets/` chụp lại theo các frame `default` (1440 và 800px), `all` (đang dính tiêu đề), `single`, `flag`, `new`, `hidden`. Màn đồng ý giữ ảnh cũ nếu không đổi. Dữ liệu mẫu như vòng 2.

### Acceptance criteria (vòng 3)
- [x] Tiêu đề ngày, đường ray, khoảng cách, dải phiên khớp Spec (số đo và token tương ứng trong app).
- [x] Ngày đang thu hiện chip cờ của ngày đó. Chip là nút riêng, bấm thì mở ngày và tới sự kiện căn cứ.
- [x] "Hôm nay" chỉ ở ngày hôm nay (theo giờ máy mentor).
- [x] Chỉ một ngày thì dùng nhãn nhẹ, không có nút mở/thu.
- [x] "Mở tất cả / Thu tất cả" nằm trên hàng thông tin học viên; không còn hàng riêng.
- [x] Tiêu đề ngày đang mở dính khi cuộn, ngày sau đẩy ngày trước. Thu từ tiêu đề dính thì tiêu đề đó về đỉnh khung.
- [x] Phiên qua 0 giờ có dải "· tiếp từ dd/mm" ở đầu ngày sau; số phiên không đổi.
- [x] Sự kiện mới, mở/thu một ngày phía trên, "Tải thêm": nội dung đang đọc không nhảy (khi không theo dõi).
- [x] Chip "N sự kiện mới" ở mép phía có sự kiện, mũi tên đúng hướng.
- [x] "Tải thêm" ở cuối nhóm ngày mới nhất.
- [x] Ẩn rồi hiện lại nội dung thì giữ trạng thái mở/thu và vị trí cuộn.
- [x] Cột hẹp (800px): tiêu đề xuống dòng đúng Spec, không tràn ngang trong khung dòng thời gian.
- [x] Bàn phím, `aria-*`, thứ tự Tab như Spec; giảm chuyển động thì không có hiệu ứng.
- [x] `npm run typecheck`, `npm test` pass; toàn bộ `npm run e2e` không có lỗi mới (đã biết có sẵn trên main: `s26-ai-grading`, `training-export.spec.ts:99`).

### Test (vòng 3)
- Domain: dải "tiếp từ" khi phiên qua 0 giờ; cờ theo ngày (cờ nào thuộc ngày nào, theo sự kiện căn cứ); "Hôm nay".
- Controller hoặc hàm thuần: neo vị trí đọc (tính lại `scrollTop` từ phần tử neo) nếu tách được; hướng của chip "N sự kiện mới".
- E2E `e2e/training-multi-day.spec.ts`: chip cờ trên ngày đang thu, nhãn nhẹ khi một ngày, nút mở/thu tất cả ở hàng học viên, tiêu đề dính (kiểm vị trí sau khi cuộn), giữ vị trí khi có sự kiện mới lúc đang đọc ngày cũ, ẩn/hiện giữ trạng thái; chụp ảnh.

### Đã làm (vòng 3)
- Component mới trong `features/training-admin/ui`: `DayGroupHeader` (biến thể `default` / `light`, chip cờ là nút riêng, `data-sticky`/`data-pinned`), `SessionMarker` (`mở lúc` / `tiếp từ dd/mm`). Không tách `CollapsibleSection` (vùng nội dung là một `div role="region"` trong `Timeline`).
- Domain: `buildTimeline` thêm dải phiên lặp `continuedFrom` ở đầu ngày sau (số phiên theo cả buổi); `dayFlags` (cờ theo ngày, chip "Có thể đang kẹt" ở ngày có lượt lỗi còn chạy), `dayGroupSpoken`, `isToday`, `latestSide`, `keepAnchorScrollTop`. `jumpToFlag(code, dayKey?)`. Bỏ `dayGroupSummary`.
- `Timeline.tsx`: tiêu đề dính (chỉ ngày đang mở, đo bằng `data-day-group`), giữ vị trí đọc bằng phần tử neo (ghi lại ở mỗi lần cuộn/layout, đặt lại trước các lần cuộn khác), chip "N sự kiện mới" ở mép phía có sự kiện (mép trên thì nằm dưới tiêu đề dính), "Tải thêm" cuối nhóm ngày mới nhất, ẩn nội dung giữ trạng thái và vị trí (neo vẫn còn khi bật lại), nút Mở/Thu tất cả lên hàng học viên.
- Ảnh `docs/design/S42-assets/` chụp lại (1 mặc định, 2 hẹp 800px, 3 tiêu đề dính, 5 một ngày, 6 chip cờ, 7 sự kiện mới, 8 ẩn, 9 chi tiết lượt); ảnh đồng ý giữ nguyên.
- Token: đủ, không đặt giá trị mới. Lệch/ghi chú:
  - Spec `shadow-raised`, `focus-ring`, `dur-fast`, `pq-fade`, `brand-100/700`, `wrong-600`, `ink-*` đều có sẵn. Màu bóng của tiêu đề dính (`rgba(20,23,28,.20)`) là giá trị trong Spec, không có token.
  - Thêm một keyframe `pq-flash` vào `styles/index.css` cho hiệu ứng "tô kiểu focus rồi nhạt dần" của thẻ prompt (chưa có sẵn); giảm chuyển động thì tắt.
  - Dòng tóm tắt "4 ngày · 12 prompt · 21 lệnh" của frame `default` không nằm trong phạm vi, chưa làm.
  - Thẻ prompt bỏ icon trái, nền trắng như Spec; kiểu "focus" của thẻ vẫn là nền vàng nhạt sẵn có (Spec ghi dev dùng kiểu sẵn có).
  - Ở cột hẹp tóm tắt xuống dòng; tiêu đề vẫn cao 44px (hai dòng vừa trong 44px).
  - Chip "N sự kiện mới" tự biến mất khi sự kiện mới nhất vào khung nhìn (theo quy tắc theo dõi vòng 2).

