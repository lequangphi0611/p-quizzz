# S28 — Xếp câu "Cần bàn trước" trong chế độ thảo luận

**Phụ thuộc:** S17 · **Trạng thái:** chưa làm

## Bối cảnh
Thời gian chữa bài ngắn; mentor muốn vào thẳng câu nhiều người sai thay vì bấm qua từng câu. Màn thảo luận chiếu trên máy mentor nên cả lớp thấy mọi thứ mentor bấm, kể cả bộ lọc. Business: [PRODUCT.md §7.30](../PRODUCT.md), §7.17, §4.6.

## Quyết định của PO (2026-11-18)
Phương án A trong báo cáo làm rõ yêu cầu: một nút xếp lại, tên trung tính, không hiện lý do. Một tiêu chí duy nhất là tỉ lệ làm đúng. Câu nhiều đáp án tính "đúng trọn bộ". Tự luận để sau cùng. Không thêm nhãn mới: sau khi mở đáp án, "Nhầm phổ biến", tỉ lệ đúng và số bỏ trống đã có sẵn từ S17.

## Phạm vi
- **Không đổi server, không đổi contract API.** Dùng `correctCount`, `submitted`, `type`, `position` đã có trong `GET /api/admin/sessions/:id/discussion`.
- Web `features/discussion`:
  - Domain (thuần, trong `domain/discussion-ui.ts` hoặc file mới): `priorityOrder(questions, submitted) → number[]` trả chỉ số câu theo thứ tự §7.30b: trắc nghiệm có tỉ lệ `correctCount / submitted` tăng dần, bằng nhau thì theo `position`; `submitted === 0` thì xuống cuối nhóm trắc nghiệm; tự luận sau cùng theo `position`.
  - Trạng thái bật/tắt nằm trên URL (ví dụ `?order=priority`) để F5 không mất. `?q=` vẫn là **số câu theo đề gốc**, nên bật/tắt không đổi câu đang chiếu.
  - Điều hướng (←/→, nút trước/sau, thanh câu) đi theo thứ tự đang chọn.
  - `QuestionNav` (size `screen`) nhận thêm nhãn số cho từng ô, mặc định `i + 1`, để hiện **số câu theo đề gốc** khi đã xếp lại; `aria-label` dùng cùng số đó. `QHeader` cũng ghi số theo đề gốc.
  - Nút bật/tắt "Cần bàn trước" trên thanh câu (tone `screen`, dùng `Button` sẵn có), có phím tắt (đề xuất `S`, thêm vào `domain/shortcuts.ts` và dòng gợi ý phím).
- Không hiện tỉ lệ hay nhãn lý do ở thanh câu hoặc nút (§7.30c).

## Acceptance criteria
- [ ] Mặc định giữ thứ tự đề như trước.
- [ ] Bật "Cần bàn trước": câu trắc nghiệm ít người đúng lên trước, bằng tỉ lệ thì theo thứ tự đề, tự luận ở cuối; bấm lại thì về thứ tự đề.
- [ ] Câu nhiều đáp án xếp theo số bài đúng trọn bộ.
- [ ] Thanh câu và tiêu đề câu luôn ghi số câu theo đề gốc ở cả hai chế độ.
- [ ] ←/→ và nút trước/sau đi theo thứ tự đang chọn; bật/tắt không đổi câu đang chiếu; F5 giữ cả chế độ lẫn câu đang chiếu.
- [ ] Không có con số hay nhãn mới nào hiện trước khi mở đáp án.
- [ ] Cảnh báo tự luận chưa chấm và hộp "Chốt kết quả" hoạt động như cũ ở cả hai chế độ.

## Test
- Domain: `priorityOrder` (tỉ lệ khác nhau, bằng tỉ lệ, `submitted = 0`, câu multi, tự luận, đề toàn tự luận); phím tắt mới trong `shortcuts.test.ts`.
- `QuestionNav.test.ts`: nhãn số tuỳ chỉnh.
- E2E (tuỳ chọn): bật "Cần bàn trước" trong chế độ thảo luận, kiểm câu đầu tiên và số câu hiển thị; ảnh chụp vào `docs/design/S28-assets/`.

## Giới hạn đã biết / chưa làm
- Bản thân thứ tự là một gợi ý về đáp án (§7.30, giới hạn đã biết).
- Chưa làm: lọc theo từng tiêu chí, "đúng một phần" ở câu nhiều đáp án, câu người điểm cao lại sai, xem số liệu riêng trước buổi chữa (phase 2).
- UI dùng component sẵn có, chưa qua designer.
