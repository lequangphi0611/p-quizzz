# S36 — UI member: vào buổi training, đồng ý, cài và gỡ hook

**Phụ thuộc:** S32, S33 · **Trạng thái:** ⬜ chưa làm · **UI chờ bản thiết kế** ([prompt](../design/S35-S36-training-ui-prompt.md))

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
- [ ] Gõ mã của buổi training ở `/` → tới màn nhập tên + đồng ý; mã phiên thi vẫn như cũ.
- [ ] Không tick đồng ý thì không gửi được `join`.
- [ ] Màn cài hiển thị đúng đoạn cấu hình của chính member; nút sao chép hoạt động; nhận sự kiện đầu tiên → "Đã nhận tín hiệu" trong ≤ 3 giây.
- [ ] Rút đồng ý → về màn đầu, token bị xoá khỏi trình duyệt.
- [ ] Sau Dừng thu, màn chuyển sang hướng dẫn gỡ; luồng kiểm tra cho đúng kết quả `passed`/`failed`.
- [ ] Không màn nào hiển thị prompt, lệnh hay output đã thu.

## Test
- Domain + controller của `features/training-member` bằng gateway giả (chuyển màn theo `status`/`connection`/`uninstallCheck`).
- E2E `e2e/training-member.spec.ts`: nhập mã → đồng ý → (gửi JSON hook giả tới ingest bằng `request`) → "Đã nhận tín hiệu" → mentor dừng qua API → kiểm tra gỡ; ảnh vào `docs/design/S36-assets/`.

## Giới hạn đã biết / chưa làm
- App không tự sửa file trên máy member; cài và gỡ do member làm (hoặc nhờ Claude Code).
- Không kiểm được hook có nằm đúng thư mục bài tập hay không.
