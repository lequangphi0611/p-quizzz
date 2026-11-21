# S36 — UI member: vào buổi training, đồng ý, cài và gỡ hook

**Phụ thuộc:** S32, S33 · **Trạng thái:** ✅ xong · **Thiết kế:** [bản thiết kế](https://claude.ai/artifact/4LDc4JsZ1p7W6jPYbxrpuR#page-dcb81aee8d83), [nhận xét + bản đồ màn hình](../design/S35-S36-training-ui-review.md), [prompt](../design/S35-S36-training-ui-prompt.md)

## Bối cảnh
Member phải hiểu rõ mình đồng ý gửi gì, cài đúng chỗ (chỉ thư mục bài tập), biết chắc đã kết nối, và cuối buổi gỡ sạch. Member không xem được dữ liệu đã thu. Business: [PRODUCT.md §7.34](../PRODUCT.md) (b), (d), (g), (h); §1 (ngoại lệ "không cài đặt").

## Phạm vi
Contract: `architecture.md` §5 "Buổi training AI" (member), §8 (`/training/:id`), §11.8 (Web).

- **Web**
  - `features/member-join`: `resolve` trả `kind: 'training'` → chuyển tới `/training/:id` kèm mã (không đổi gì khác của luồng phiên thi).
  - `features/training-member/{domain,application,infrastructure,ui}`:
    1. **Nhập tên + đồng ý:** liệt kê cụ thể dữ liệu được gửi (prompt; tên công cụ, câu lệnh, pass/fail, thời gian; output và nội dung thay đổi file, có thể chứa bí mật), chỉ thu trong thư mục bài tập, chỉ mentor xem, member không xem lại được, xoá khi mentor bấm Kết thúc, rút lại được bất cứ lúc nào. Không đồng ý → chỉ có nút quay lại.
    2. **Cài:** hướng dẫn chọn thư mục bài tập riêng (không phải repo công ty); hai cách: sao chép `mergePrompt` để nhờ Claude Code ghép, hoặc sao chép đoạn `settings` để tự ghép vào `.claude/settings.local.json` (nhấn mạnh **ghép, không ghi đè**, không đặt vào `~/.claude/settings.json`); nhắc chấp nhận hộp thoại tin cậy thư mục; chờ tín hiệu (poll 3 giây) → "Đã nhận tín hiệu". Gợi ý xử lý khi chờ lâu (sai thư mục, chưa mở lại Claude Code, máy có proxy).
    3. **Đang thu:** trạng thái kết nối, nút "Rút lại đồng ý" (xác nhận, nói rõ dữ liệu bị xoá và cần gỡ hook).
    4. **Sau Dừng thu:** hướng dẫn gỡ đúng đoạn đã thêm (hoặc sao chép câu nhờ Claude Code gỡ) → "Kiểm tra" → gõ một prompt bất kỳ → "Xong" → `passed` ("Đã gỡ") hoặc `failed` (hướng dẫn kiểm tra lại bằng `/hooks`).
  - Token ở `localStorage` key `pq:training:<id>`; 401 → về màn nhập mã.
  - Dùng tốt trên laptop là chính; điện thoại chỉ cần đọc được trạng thái (cài đặt làm trên laptop).

## Acceptance criteria
- [x] Gõ mã của buổi training ở `/` → tới màn nhập tên + đồng ý; mã phiên thi vẫn như cũ.
- [x] Không tick đồng ý thì không gửi được `join`.
- [x] Màn cài hiển thị đúng đoạn cấu hình của chính member; nút sao chép hoạt động; nhận sự kiện đầu tiên → "Đã nhận tín hiệu" trong ≤ 3 giây.
- [x] Rút đồng ý → về màn đầu, token bị xoá khỏi trình duyệt.
- [x] Sau Dừng thu, màn chuyển sang hướng dẫn gỡ; luồng kiểm tra cho đúng kết quả `passed`/`failed`.
- [x] Không màn nào hiển thị prompt, lệnh hay output đã thu.

## Test
- Domain + controller của `features/training-member` bằng gateway giả (chuyển màn theo `status`/`connection`/`uninstallCheck`).
- E2E `e2e/training-member.spec.ts`: nhập mã → đồng ý → (gửi JSON hook giả tới ingest bằng `request`) → "Đã nhận tín hiệu" → mentor dừng qua API → kiểm tra gỡ; ảnh vào `docs/design/S36-assets/`.

## Giới hạn đã biết / chưa làm
- App không tự sửa file trên máy member; cài và gỡ do member làm (hoặc nhờ Claude Code).
- Không kiểm được hook có nằm đúng thư mục bài tập hay không.

## Báo cáo hoàn thành

**Đã làm**
- `features/member-join`: `resolveRoom` trả `ResolvedRoom`; controller thêm `lookup.training` + `selectTrainingRoom`; `JoinForm` gọi `onTraining`, `MemberHomePage` chuyển bằng `navigate('/training/:id?room=<mã>', { replace: true })`. **Mã phòng đi theo query `?room=`** (cùng quy ước link `/?room=`); sau khi vào, trang training tự bỏ query khỏi địa chỉ. `replace` để nút Back không rơi vào link tự nhảy tiếp. Luồng phiên thi giữ nguyên (test cũ pass, thêm 6 test cho nhánh training).
- `features/training-member`: `domain/` (`decideTrainingScreen`, đếm lùi 5 giây, nhịp poll, gợi ý sau 1 phút, phân loại lỗi join, câu nhờ Claude Code gỡ, nội dung màn đồng ý dạng dữ liệu có test), `application/` (`TrainingMemberController` + hook), `infrastructure/` (thêm `resolveRoom` vào gateway), `ui/` (các màn 1-9, `CodeBlock` có nút sao chép, hộp rút lại đồng ý).
- Màn đồng ý có test giữ đúng contract: liệt kê từng loại dữ liệu, bí mật, Read chỉ gửi tên file + số dòng, lưu ý lệnh đụng chỗ khác vẫn bị gửi, mạng LAN không mã hoá.
- Quyết định về poll: 3 giây khi chờ tín hiệu đầu / đang kiểm tra gỡ / mất kết nối; **10 giây** khi đang thu và khi xem hướng dẫn gỡ (để nhận ra "Dừng thu" hoặc "Kết thúc"); dừng hẳn ở màn đồng ý, kết thúc, "Đã gỡ"; tab ẩn không poll, hiện lại thì hỏi ngay. Hệ quả: mentor bấm Dừng thu thì member đang xem màn "đang thu" thấy màn gỡ sau tối đa ~10 giây.
- Cài đặt (bước 1-3) là **một trang cuộn** có ba bước, không tách ba màn; bước 3 luôn hiện trạng thái chờ.

**Lệch / đoán**
- Không đọc được nội dung canvas thiết kế (artifact kiểu canvas, nội dung nằm trong file từng artboard): bố cục theo `S35-S36-training-ui-review.md` + prompt, dùng component có sẵn.
- Mở `/training/:id` khi chưa có token và không có `?room=` thì hiện màn "Không vào được buổi training" + nút nhập lại mã (không có ô nhập mã ngay trên trang).
- Member không có "danh sách buổi của máy này" (như S27): sau khi mentor Dừng thu, mã không còn hợp lệ nên gõ lại ở `/` không vào lại được; chỉ mở lại được bằng địa chỉ `/training/:id` đang có token.
- 401 ở bất kỳ đâu: xoá token và hiện màn "Buổi training đã kết thúc" (có nút về trang đầu), thay vì tự chuyển thẳng về `/`. Rút lại đồng ý và "Không tham gia" thì về `/` ngay.
- Nút "Đồng ý và tiếp tục" là nút chính, "Không tham gia" là nút viền đậm cùng cỡ, cùng hàng, luôn bật, không mờ.
- Không có icon thư mục trong `assets/icons`: bước 1 dùng số thứ tự, không icon.

**Đã kiểm**
- `npm test` (161 file, 1335 test), `npm run typecheck`, `npm run arch:check` pass.
- E2E `e2e/training-member.spec.ts` (7 test, cổng 3102) pass; cùng `00-smoke`, `s20`, `s22`, `s29`, `member-after-close` pass. Ảnh ở `docs/design/S36-assets/` (1440×900 và 390×844); đã xem lại và sửa lỗi bố cục (chữ trong khung lưu ý bị xé dòng, vòng focus thừa, đếm lùi hiện 6, tab quá dài trên điện thoại).
- Đã thử bằng Playwright: sao chép bằng clipboard (đọc lại đúng nội dung), tên trùng, mã sai/buổi đã dừng, mất mạng (banner + tự hồi phục), rút lại đồng ý khi mất mạng rồi có mạng, gợi ý sau 1 phút (đồng hồ giả của Playwright).

**Chưa kiểm**
- Chưa chạy với Claude Code thật, Windows/macOS, Wi-Fi thật, máy có proxy; chưa kiểm hộp thoại tin cậy thư mục và việc Claude Code có cần mở lại sau khi ghép/gỡ (câu chữ theo spike + mergePrompt).
- Nút sao chép trên http LAN (không phải localhost) chưa thử trên máy khác: có phương án `execCommand` rồi chọn sẵn văn bản, có test đơn vị nhưng không có e2e trên http không-localhost.
- Trình đọc màn hình thật chưa thử (chỉ kiểm có vùng `aria-live="polite"` và `role="alert"`).
