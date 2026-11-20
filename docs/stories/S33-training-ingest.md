# S33 — Nhận sự kiện hook của Claude Code (ingest), trạng thái kết nối và kiểm tra gỡ

**Phụ thuộc:** S32 · **Trạng thái:** ⬜ chưa làm

> **Nên chạy checklist máy thật trước** ([spikes/claude-code-hooks.md §5](../spikes/claude-code-hooks.md)): kết quả về proxy, chế độ tương tác và kích thước output có thể làm đổi contract của story này.

## Bối cảnh
Claude Code trên máy member gửi JSON của hook tới server mentor. Server phải trả lời nhanh để không làm chậm member, chỉ giữ các trường đã duyệt, và giúp member biết đã cài và đã gỡ đúng chưa. Business: [PRODUCT.md §7.34](../PRODUCT.md) (c), (e), (h).

## Phạm vi
Contract: `architecture.md` §5 (`POST /api/training/ingest`, `uninstall-check`, `uninstall-check/finish`), §7 (event `training`, `TRAINING_SIGNAL_THROTTLE_MS`), §11.8 (`filterHookEvent`, `clip`, `connectionState`).

- **Server**
  - Domain: `filterHookEvent`, `clip`, `connectionState` đầy đủ, `stillSending`.
  - Use cases: `IngestHookEvent`, `StartUninstallCheck`, `FinishUninstallCheck`.
  - `trainingIngestRoute`: `bodyLimit` 2 MB; tra `ingest_token` theo index unique; `open` → lọc + lưu + cập nhật `first_seen_at`/`last_seen_at` → 204; `stopped` → không lưu, ghi `seen_after_stop_at` → 200 `{ systemMessage }`; token lạ → 404 rỗng; event khác → 204.
  - Bộ gộp tín hiệu SSE `training` (tối đa 1 lần / 2 giây / buổi); `sse-event-stream.ts` thêm cách đăng ký event `training` cho kênh mentor.
  - `GetMyTraining` trả `connection` và `uninstallCheck` thật.

## Acceptance criteria
- [ ] Với các payload thật trong spike: `UserPromptSubmit` lưu đúng `prompt`; `PostToolUse` Bash lưu `toolTarget` = câu lệnh, `ok = true`, `durationMs`, output đã `clip`; `PostToolUseFailure` lưu `ok = false`, `errorExcerpt`; `Write`/`Edit` lưu `toolTarget` là đường dẫn tương đối và `change`; `Stop` không lưu gì.
- [ ] Không cột nào chứa `transcript_path`, `cwd`, đường dẫn tuyệt đối, `last_assistant_message` (test quét bản ghi).
- [ ] Output 10 000 dòng → lưu 200 dòng đầu + 200 dòng cuối, `omittedLines = 9 600`; mỗi phần ≤ 32 KB.
- [ ] Body > 2 MB → 413; JSON sai dạng → 204, không lưu, không 500.
- [ ] Sự kiện đầu tiên → member chuyển `connected`; `GET /api/training/me` phản ánh trong lần poll kế tiếp.
- [ ] Sau `stop`: ingest trả 200 kèm `systemMessage` tiếng Việt, không lưu; `stillSending = true` cho member đó.
- [ ] Kiểm tra gỡ: `uninstall-check` → (không có sự kiện) → `finish` sau ≥ 5 giây → `passed`, `connection = uninstalled`; có sự kiện sau lúc bắt đầu → `failed`; gọi `finish` sớm → 409 `too_early`; buổi không `stopped` → 409.
- [ ] 50 sự kiện trong 1 giây cho một buổi → kênh mentor nhận tối đa 1 tín hiệu `training` mỗi 2 giây.
- [ ] Ingest không gọi mạng, chỉ một lần ghi DB (đo trong test tích hợp: < 50 ms trên DB `:memory:` cho payload 1 MB).

## Test
- Domain: `filterHookEvent.test.ts` (fixture = payload thật của spike, đặt trong `domain/training/fixtures/`), `clip.test.ts`, `connection-state.test.ts`.
- Use case: ingest với fake repo + fake clock (`open`/`stopped`/token lạ); kiểm tra gỡ.
- Tích hợp HTTP: `test/integration/training-ingest.test.ts` (204/200/404/413, quét bản ghi, bộ gộp SSE).

## Giới hạn đã biết / chưa làm
- Dữ liệu đi qua LAN bằng HTTP không mã hoá; server chỉ lọc được sau khi đã nhận.
- Ai có `ingest_token` gửi được sự kiện giả cho member đó (không đọc được gì).
- Không có giới hạn số sự kiện mỗi member; xem lại sau khi đo trên máy thật.
