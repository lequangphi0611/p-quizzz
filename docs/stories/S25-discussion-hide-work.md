# S25 — Thảo luận: đọc đề trước, ẩn bài làm của lớp

**Phụ thuộc:** S17 · **Thiết kế UI:** [prompt cho designer](../design/S25-discussion-hide-work-ui-prompt.md); bản vẽ: p-quizzz Design System bản 5, `ui_kits/p-quizzz/discussion/Thao luan - an bai lam board.html` (PO duyệt 2026-11-17) · **Trạng thái:** ✅ xong (2026-11-17)

## Bối cảnh
Màn thảo luận (S17) đã ẩn đáp án, nhưng **số người chọn từng phương án** và **các bài tự luận** hiện ngay khi mở câu. Thấy "80% chọn B" là cả lớp ngả theo B, nên việc ẩn đáp án mất tác dụng. Mentor muốn mỗi câu mở ra **chỉ có đề**, rồi tự chọn lúc mở bài làm của lớp và lúc mở đáp án, theo thứ tự tuỳ câu. Business: [PRODUCT.md §4.6, §7.17d](../PRODUCT.md) (PO duyệt 2026-11-17, phương án "hai nút độc lập").

Chỉ là thay đổi giao diện trong `features/discussion/`. **Không đổi API** (`GET /sessions/:id/discussion` giữ nguyên; dữ liệu đã có sẵn trên máy mentor, chỉ không hiển thị).

## Phạm vi

### Trạng thái mỗi câu
- Hai cờ độc lập theo từng câu: **bài làm đã mở** và **đáp án đã mở** (cờ thứ hai là `revealed` hiện có). Câu chưa mở: cả hai ẩn. Câu đã mở: giữ nguyên khi quay lại. Tải lại trang: ẩn lại hết. Không gửi đi đâu, không lưu trình duyệt.
- Phím: `Space` hiện/ẩn đáp án (như cũ); **`B`** hiện/ẩn bài làm. Thêm vào `domain/shortcuts.ts` (`toggleWork`) và gợi ý phím trên màn.

### Trắc nghiệm, khi bài làm ẩn
- Vẫn hiện đề, body và **các phương án A/B/C/D** (đủ để đọc đề), nhưng **không** có thanh tỉ lệ, số người chọn, cờ "Nhầm phổ biến", dòng "x/y làm đúng".
- Dòng cuối vẫn hiện "N bài · k bỏ trống" (không lộ cách lớp làm).
- Nút **"Hiện bài làm"** (`B`) cạnh nút "Hiện đáp án" (`Space`).

### Trắc nghiệm, bốn tổ hợp
| Bài làm | Đáp án | Hiển thị |
|---|---|---|
| ẩn | ẩn | Phương án trơn, khung "Đáp án và giải thích đang ẩn" |
| mở | ẩn | Như S17 hiện tại (thanh trung tính + số người chọn) |
| ẩn | mở | Phương án tô đúng/sai + lời giải; **không** có số liệu, không "Nhầm phổ biến", không "x/y làm đúng" |
| mở | mở | Như S17 khi đã hiện đáp án |

### Tự luận, khi bài làm ẩn
- Hiện đề, body, khung đáp án mẫu/rubric (ẩn/hiện bằng `Space` như cũ). Thay danh sách bài bằng một khung "Bài làm của lớp đang ẩn · N bài (k bỏ trống)" + nút "Hiện bài làm".
- `J`/`K` không làm gì khi bài làm đang ẩn (không mở bài nào).
- Tiến độ chấm `x/y` trên thanh câu và đầu trang vẫn hiện (không lộ nội dung bài).
- Mở bài làm thì về đúng màn danh sách / từng bài như S17. Ẩn lại bài làm khi đang ở chế độ từng bài thì về danh sách (đang ẩn).

### Chỉ báo và đánh dấu (theo bản vẽ, PO duyệt thêm 2026-11-17)
- **Chỉ báo cố định** ở góc phải thanh chọn câu: hai chip "Bài làm · Đang ẩn/Đã hiện" và "Đáp án · Đang ẩn/Đã hiện" (nét đứt + `eye-off` khi ẩn, nét liền vàng + `eye` khi hiện). Cùng chỗ cho mọi loại câu.
- **Thanh chọn câu**: icon nhỏ `users` / `key-round` dưới số câu cho câu đã mở bài làm / đáp án.
- **Vị trí nút**: mỗi nút nằm trong phần nó mở. Trắc nghiệm: "Hiện đáp án" (nút chính, `key-round`) ở đáy cột trái trong khung đáp án; "Hiện bài làm" (nút phụ, `users`) ở đáy cột phải. Tự luận: "Hiện đáp án" trong khung rubric; "Hiện bài làm" giữa khung bài làm đang ẩn, khi đã mở thì "Ẩn bài làm" trên đầu lưới bài.
- **Gợi ý phím**: thêm `B bài làm`; `J K` luôn có mặt, mờ 35% khi không dùng được (câu trắc nghiệm hoặc bài làm đang ẩn).
- **Hiệu ứng**: mở bài làm thì thanh tỉ lệ mọc từ 0, mỗi hàng trễ `--dur-fast/2`; thẻ bài tự luận hiện lần lượt. Giảm chuyển động → hiện tức thì.

## Quy tắc
- Không đổi quy tắc chấm, chốt, ẩn danh của S17.
- Không đổi API, màn chiếu công khai `/screen`, trang member.

## Ngoài phạm vi
- Giữ đáp án ở trang "Xem lại bài" của member tới khi mentor mở (PO tạm hoãn, chỉ xét lại nếu thấy member xem trước phá buổi thảo luận).
- Tuỳ chọn "mở sẵn bài làm", lọc/sắp xếp/đánh dấu bài tự luận để chiếu.

## Acceptance criteria
- [x] Mở màn thảo luận: câu đầu chỉ có đề (trắc nghiệm có phương án nhưng không số liệu; tự luận không có danh sách bài). Sang câu chưa mở cũng vậy.
- [x] `B`/nút mở và ẩn bài làm; `Space`/nút mở và ẩn đáp án; hai nút độc lập, đủ 4 tổ hợp như bảng trên.
- [x] Đáp án mở mà bài làm ẩn: không hiện số người chọn, "Nhầm phổ biến", "x/y làm đúng".
- [x] Quay lại câu đã mở: giữ trạng thái; tải lại trang: ẩn lại hết.
- [x] Tự luận: bài làm ẩn thì `J`/`K` không mở bài; mở rồi chấm được như S17; ẩn lại khi đang xem từng bài thì về danh sách.
- [x] Chỉ báo hai chip và đánh dấu trên thanh câu đúng trạng thái từng câu.
- [x] Đọc rõ khi chiếu ở 1920×1080 và 1366×768, không tràn ngang.

## Test bắt buộc
- `domain/shortcuts.test.ts`: `B` → `toggleWork`; `J`/`K` không có tác dụng khi bài làm ẩn; bỏ qua khi đang gõ trong ô nhập.
- `application/discussion-controller.test.ts`: hai cờ độc lập theo câu; ẩn bài làm khi đang ở chế độ từng bài → về danh sách.
- UI: e2e hoặc thao tác tay, ghi lại luồng (4 tổ hợp, tự luận ẩn/mở rồi chấm).

## Thiết kế
Chạm màn cả lớp nhìn từ xa. Cần chốt với designer (hoặc PO duyệt bản dùng lại thành phần sẵn có): phương án "trơn" khi bài làm ẩn, khung "Bài làm của lớp đang ẩn" cho tự luận, chỗ đặt hai nút, phân biệt rõ trạng thái "đã mở bài làm, chưa mở đáp án". Dùng lại `hiddenPanel`, `RevealButton`, `OptionTally` (thêm biến thể không số liệu).

## Ghi chú khi làm
- Không đổi API. State `work` (tập id câu đã hiện bài làm) nằm cạnh `revealed` trong `DiscussionController`, cùng vòng đời (mất khi tải lại).
- `OptionTally` thêm `tally` / `stagger`; ô chữ cái câu nhiều đáp án đổi sang `radius-sm` theo bản vẽ. `RevealStatus` mới ở `features/discussion/ui/`. `QuestionNav` (shared) thêm `marks` cho cỡ `screen`.
- **Lệch so với bản vẽ**: dòng "N bài · k bỏ trống" ở câu tự luận đếm **cả bài bỏ trống** (bản vẽ: 9 bài không trống + 4 bỏ trống), để khớp câu trắc nghiệm ("30 bài · 3 bỏ trống") và tiến độ chấm (cũng tính bài bỏ trống, S17). Thẻ bài hiện lần lượt chỉ khi vừa mở bài làm, không lặp lại mỗi lần quay về từ một bài (trễ tối đa 12 thẻ).
- Tiêu đề câu hỏi trên app nhỏ hơn bản vẽ (token `--fs-screen-question` có sẵn từ S17), không đổi trong story này.

## Đã kiểm
- Unit: `domain/shortcuts.test.ts` (B, J/K khi ẩn), `application/discussion-controller.test.ts` (hai cờ độc lập, ẩn bài làm khi đang xem bài → về danh sách).
- E2E: `e2e/s25-discussion-hide-work.spec.ts` (5 học viên qua API; 4 tổ hợp trắc nghiệm, câu nhiều đáp án, tự luận ẩn/mở/chỉ rubric, J khi ẩn, đánh dấu thanh câu, giữ trạng thái khi quay lại, tải lại thì ẩn hết, 1366×768). `e2e/discussion-layout.spec.ts` sửa để bấm `B` trước khi kiểm danh sách bài. Ảnh: `docs/design/S25-assets/`.
