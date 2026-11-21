# Spike: thu prompt và hoạt động công cụ của Claude Code qua hook HTTP

> Ngày thử: 2026-11-20 · Claude Code 2.1.329 · Linux (sandbox), chế độ chạy một lần `claude -p`.
> Phục vụ: `docs/PRODUCT.md` §7.34 (Buổi training AI). Chưa thử trên máy thật của member.

## 1. Câu hỏi cần trả lời

1. Hook có cài được chỉ trong một thư mục (không ảnh hưởng dự án khác) không?
2. Hook HTTP có gửi được tới `http://<IP LAN>` và gắn mã định danh không?
3. Dữ liệu gửi đi gồm những gì? Có phân biệt pass/fail và đo được thời gian không?
4. Server chậm, tắt, hoặc máy mentor rời mạng thì member có bị chặn hay chậm không?
5. Gỡ thế nào, quên gỡ thì sao?

## 2. Cấu hình đã thử

File `.claude/settings.local.json` trong thư mục bài tập (mỗi member một mã riêng):

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "http", "url": "http://<IP-mentor>:<cổng>/api/training/ingest", "headers": { "X-Training-Token": "<mã-member>" }, "timeout": 1 }] }],
    "PostToolUse":        [{ "matcher": "*", "hooks": [{ "type": "http", "url": "http://<IP-mentor>:<cổng>/api/training/ingest", "headers": { "X-Training-Token": "<mã-member>" }, "timeout": 1 }] }],
    "PostToolUseFailure": [{ "matcher": "*", "hooks": [{ "type": "http", "url": "http://<IP-mentor>:<cổng>/api/training/ingest", "headers": { "X-Training-Token": "<mã-member>" }, "timeout": 1 }] }]
  }
}
```

Đường dẫn `/api/training/ingest` ở đây chỉ để minh hoạ, chưa chốt. Cố ý **không** bắt sự kiện `Stop`, vì nó chứa câu trả lời của Claude (`last_assistant_message`).

## 3. Kết quả

| # | Kiểm tra | Kết quả |
|---|---|---|
| 1 | Hook trong `.claude/settings.local.json` của thư mục | ✅ Chạy. Theo tài liệu, ở chế độ tương tác hook chỉ chạy khi thư mục đã được tin cậy (chưa thử) |
| 2 | Gửi tới `http://` IP không phải localhost, header tuỳ chỉnh | ✅ Nhận đủ, `content-type: application/json`, header `X-Training-Token` tới server |
| 3 | `UserPromptSubmit` | Có `prompt` nguyên văn, `session_id`, `cwd` (đường dẫn tuyệt đối), `transcript_path`, `permission_mode` |
| 3 | `PostToolUse` | `tool_name`, `tool_input` (Bash: `command`; Write: `file_path` + **toàn bộ `content`**), `tool_response` (Bash: **`stdout`/`stderr` nguyên văn**), `duration_ms` |
| 3 | `PostToolUseFailure` | `tool_name`, `tool_input`, `error` (chuỗi lỗi ngắn, ví dụ `Exit code 2\nls: cannot access ...`), `duration_ms` |
| 3 | `Stop` (không dùng) | Có `last_assistant_message` = câu trả lời của Claude |
| 4 | Server tắt, máy vẫn trong mạng (từ chối kết nối) | ✅ Không chặn, không chậm thấy được |
| 4 | Server trả lời chậm 4 giây, timeout 5 | ❌ Prompt bị giữ khoảng 4 giây rồi mới gửi tới model |
| 4 | Như trên với `"async": true` | ❌ Không cải thiện (ít nhất ở chế độ `-p`) |
| 4 | **Timeout 1**: server prompt chậm 4 giây, sự kiện công cụ trỏ tới IP không phản hồi | ✅ Cả lượt chậm thêm khoảng 0,6 giây (đo 2 lần) |
| 5 | Server trả `{"systemMessage": "..."}` | Claude Code nhận được (thấy trong `hook_response` của stream-json). **Chưa xác nhận** có hiển thị cho member ở chế độ tương tác |
| – | Proxy | Lần đầu thất bại vì IP đích không nằm trong `NO_PROXY`: hook HTTP đi qua `HTTPS_PROXY`. Máy member có proxy công ty có thể gặp đúng lỗi này |

Lỗi hook (kết nối thất bại, quá timeout, mã khác 2xx) mặc định **không chặn** member, khớp với tài liệu (`hooks.md`).

## 4. Hệ quả cho thiết kế

- **Phạm vi cài**: chỉ `.claude/settings.local.json` của thư mục bài tập. Telemetry OpenTelemetry không dùng được ở phạm vi này (tài liệu: biến OTEL trong file của repo bị bỏ qua), nên loại.
- **Dữ liệu thừa phải lọc ở server**: hook HTTP gửi nguyên JSON, không lọc được ở máy member. Output và nội dung file đi qua mạng LAN không mã hoá dù server có lưu hay không.
- **Timeout 1 giây cho mọi hook** + server trả lời ngay rồi mới lưu.
- **Không tự hết hạn**: hook HTTP gửi mãi cho tới khi bị gỡ. Phương án thay thế đã thử thành công là hook `command` gọi một script Node lọc dữ liệu tại máy member và tự tắt sau ngày hết hạn, nhưng cần Node trên máy member. PO chọn hook HTTP (2026-11-20).

## 5. Checklist thử trên máy thật (chưa làm)

1. Windows và macOS, Claude Code bản member đang dùng, chế độ tương tác.
2. Lần đầu mở thư mục: hộp thoại tin cậy hiện ra chưa, đồng ý xong hook có chạy ngay không.
3. Wi-Fi thật: IP LAN của máy mentor, tường lửa của hệ điều hành trên máy mentor.
4. Máy có biến proxy (`HTTPS_PROXY`): hook có tới được IP LAN không.
5. Tắt hẳn máy mentor (IP không phản hồi): đo độ trễ thực tế ở chế độ tương tác.
6. Server trả `systemMessage`: lời nhắc có hiện trong giao diện không.
7. Gỡ: xoá đoạn hook, gõ prompt thử, server không còn nhận gì. Lệnh `/hooks` không còn liệt kê.
8. Đo kích thước output thực tế của một buổi (`npm install`, `npm test`, đọc file lớn) để chốt giới hạn lưu.
9. **Windows:** chụp payload thật của công cụ `PowerShell` (tên công cụ, `tool_input`, `tool_response`, kiểu xuống dòng, `cwd`) và của `Read`, đối chiếu với fixture giả lập ở `src/server/domain/training/fixtures/hook-payloads.ts`.
10. Máy do công ty quản lý: kiểm cài đặt `allowedHttpHookUrls` (designer nêu, chưa kiểm) có chặn hook HTTP tới IP LAN không.

## 6. Tài liệu tham khảo

- https://code.claude.com/docs/en/hooks.md
- https://code.claude.com/docs/en/settings.md
- https://code.claude.com/docs/en/monitoring-usage.md
