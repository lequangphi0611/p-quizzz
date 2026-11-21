# S37: Training: thu thêm phiên, xin quyền, câu hỏi và kế hoạch của Claude

**Phụ thuộc:** S33, S36 · **Trạng thái:** ⬜ chưa làm

## Bối cảnh
Mentor muốn thấy `/clear`, `/compact`, đổi model, các lần Claude xin quyền, câu Claude hỏi cùng lựa chọn của member, và kế hoạch Claude trình. Business: [PRODUCT.md §7.35](../PRODUCT.md) (a), (f), (g). Payload thật lấy từ [spike §6](../spikes/claude-code-hooks.md).

## Phạm vi
Contract: `architecture.md` §11.9 (hook thêm, bất biến an toàn, `filterHookEvent`, cột mới).

- **Server**
  - Thêm hook vào `buildHookSettings`.
  - Mở rộng `filterHookEvent` và `isHookEvent`.
  - Migration thêm cột.
  - Ingest lưu các kind mới. `PermissionRequest` luôn trả 204 body rỗng.
- **Web member**
  - Màn đồng ý liệt kê dữ liệu mới và **rủi ro hook xin quyền** (§7.35f).
  - Hướng dẫn cài nói rõ hộp thoại tin cậy mặc định "No, exit".
  - Câu nhờ Claude ghép và câu nhờ gỡ dùng cấu hình mới.
- Chưa hiển thị các dòng mới cho mentor (S39).

## Acceptance criteria
- [ ] Cấu hình sinh ra có đủ 8 hook, mỗi hook `timeout: 1`; không có `Stop`, `PostCompact` hay hook `command`.
- [ ] Mỗi payload trong spike §6 lọc ra đúng draft:
  - [ ] `/clear` → `session/clear`.
  - [ ] `/compact <chữ>` → `session/compact_manual` với `note` là chữ đó.
  - [ ] `PostModelSwitch` → `session/model_switch` với `note` "from → to".
  - [ ] `PermissionRequest` Edit → `permission` có `change`.
  - [ ] `Notification` → `notice/waiting_permission`.
  - [ ] `AskUserQuestion` → `note` có lựa chọn của member.
  - [ ] `ExitPlanMode` → `output` là kế hoạch.
- [ ] Không chuỗi nào lưu lại chứa `cwd`, `scratchpad_dir` hay `transcript_path`. Có test quét chuỗi.
- [ ] `PermissionRequest` trả 204 body rỗng ở buổi `open`, buổi `stopped` và với token lạ. Không response nào của ingest có `hookSpecificOutput` hay `decision`. Có test HTTP.
- [ ] Màn đồng ý và hướng dẫn cài có nội dung mới; e2e member cập nhật.

## Test
- Domain: `filter-hook-event.test.ts` với fixture mới trong `fixtures/hook-payloads.ts`, chép từ payload spike §6 sau khi bỏ đường dẫn thật.
- Tích hợp HTTP: ingest các kind mới; bất biến an toàn.
- E2E: `e2e/training-member.spec.ts` (màn đồng ý, cấu hình).

## Giới hạn đã biết
- Chưa thử Windows, macOS, chế độ auto, `idle_prompt`. Member bấm Esc giữa câu trả lời không quan sát được.
