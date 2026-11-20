# S33 — Nhận sự kiện hook của Claude Code (ingest), trạng thái kết nối và kiểm tra gỡ

**Phụ thuộc:** S32 · **Trạng thái:** ✅ xong

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
- [x] Với các payload thật trong spike: `UserPromptSubmit` lưu đúng `prompt`; `PostToolUse` Bash lưu `toolTarget` = câu lệnh, `ok = true`, `durationMs`, output đã `clip`; `PostToolUseFailure` lưu `ok = false`, `errorExcerpt`; `Write`/`Edit` lưu `toolTarget` là đường dẫn tương đối và `change`; `Read` lưu `toolTarget` = đường dẫn tương đối + số dòng, **không có output** (test quét: nội dung file không nằm ở cột nào); `Stop` không lưu gì.
- [x] Không cột nào chứa `transcript_path`, `cwd`, đường dẫn tuyệt đối, `last_assistant_message` (test quét bản ghi).
- [x] Output 10 000 dòng → lưu 200 dòng đầu + 200 dòng cuối, `omittedLines = 9 600`; mỗi phần ≤ 32 KB.
- [x] Body > 2 MB → 413; JSON sai dạng → 204, không lưu, không 500.
- [x] Sự kiện đầu tiên → member chuyển `connected`; `GET /api/training/me` phản ánh trong lần poll kế tiếp.
- [x] Sau `stop`: ingest trả 200 kèm `systemMessage` tiếng Việt, không lưu; `stillSending = true` cho member đó.
- [x] Kiểm tra gỡ: `uninstall-check` → (không có sự kiện) → `finish` sau ≥ 5 giây → `passed`, `connection = uninstalled`; có sự kiện sau lúc bắt đầu → `failed`; gọi `finish` sớm → 409 `too_early`; buổi không `stopped` → 409.
- [x] 50 sự kiện trong 1 giây cho một buổi → kênh mentor nhận tối đa 1 tín hiệu `training` mỗi 2 giây.
- [x] Ingest không gọi mạng, chỉ một lần ghi DB (đo trong test tích hợp: < 50 ms trên DB `:memory:` cho payload 1 MB).

## Test
- Domain: `filterHookEvent.test.ts` (fixture dựng từ danh sách trường trong spike, đặt trong `domain/training/fixtures/`; spike không giữ JSON thô và chưa ghi payload của `Read`, nên mẫu `Read` là giả lập và cần thay bằng mẫu thật sau checklist máy thật), `clip.test.ts`, `connection-state.test.ts`.
- Use case: ingest với fake repo + fake clock (`open`/`stopped`/token lạ); kiểm tra gỡ.
- Tích hợp HTTP: `test/integration/training-ingest.test.ts` (204/200/404/413, quét bản ghi, bộ gộp SSE).

## Giới hạn đã biết / chưa làm
- Dữ liệu đi qua LAN bằng HTTP không mã hoá; server chỉ lọc được sau khi đã nhận.
- Ai có `ingest_token` gửi được sự kiện giả cho member đó (không đọc được gì).
- Không có giới hạn số sự kiện mỗi member; xem lại sau khi đo trên máy thật.
- `Grep`/`Glob` (và mọi tool ngoài `Read`/`Write`/`Edit`) vẫn lưu output theo luật "tool khác": output của `Grep` là các dòng nội dung file khớp mẫu, có thể chứa dòng của `.env`. PO mới chốt loại `Read`; cần PO xem lại có loại thêm không.
- Prompt được lưu nguyên văn, không cắt độ dài (chỉ bị giới hạn bởi body 2 MB): member dán cả file vào prompt thì file đó được lưu.

## Báo cáo hoàn thành (2026-11-20)
- **Đã làm:** `domain/training/{clip,filter-hook-event,training-event}.ts`; viết lại `connectionState`, `stillSending`, `uninstallCheckState` (có `failed`) và `uninstallCheckVerdict`; use case `ingest.ts` (`IngestHookEvent`), `StartUninstallCheck`, `FinishUninstallCheck`; cổng `TrainingEventRepository.append` (nằm trong `TrainingUnitContext.events`) và các hàm mới của member repo; `ThrottledTrainingSignals`; `trainingIngestRoute` (plugin riêng, parser JSON tự viết); hai route `uninstall-check`; phía web `onTraining?` cho kênh mentor. Fixture ở `domain/training/fixtures/hook-payloads.ts`.
- **Test:** 1199 test pass, `typecheck` và `arch:check` sạch. Có test quét **mọi cột** của mọi bản ghi (không `transcript_path`, `cwd`, câu trả lời của Claude, nội dung file đã `Read`), 10 000 dòng → 200 + 200 / 9 600, 413, JSON hỏng → 204, `stopped` → 200 `systemMessage`, kiểm tra gỡ đủ ba kết quả, bộ gộp tín hiệu, payload 1 MB < 50 ms.
- **Lỗi bắt được nhờ test quét:** `tool_response` của `Write` mang đường dẫn tuyệt đối và output của Bash/Glob có thể chứa `cwd`. Đã sửa: `Write`/`Edit` không lưu output, mọi chuỗi giữ lại được thay phần `cwd` bằng đường dẫn tương đối. Đã ghi vào architecture.md §11.8.
- **Chi tiết contract để ngỏ, đã chốt (architecture.md §5, §7, §11.8):** sự kiện lạ, thân hỏng hoặc rỗng → 204 và không cập nhật `last_seen_at`; ở buổi `stopped` chỉ ba loại hook của mình mới tính là "vẫn gửi"; `uninstallCheck` suy ra từ dữ liệu, không thêm cột; bắt đầu kiểm tra lại được; bộ gộp tín hiệu là "đầu gửi ngay + một tín hiệu cuối khi hết 2 giây" và chỉ áp cho ingest; `hook_event_name` được suy ra từ các trường khi thiếu.
- **Chưa kiểm / cần PO lưu ý:** (1) chưa chạy Claude Code thật. Spike không giữ JSON thô nên fixture dựng từ danh sách trường; **mẫu `Read` là giả lập** (bộ lọc không phụ thuộc hình dạng `tool_response` của `Read`), cần thay bằng mẫu thật sau checklist máy thật (spike §5). (2) Rủi ro `Grep`/`Glob` và prompt dài ở mục "Giới hạn đã biết".
