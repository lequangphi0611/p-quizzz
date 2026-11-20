# S32 — API buổi training AI: tạo, dừng thu, kết thúc, member vào và đồng ý

**Phụ thuộc:** S03, S20 · **Trạng thái:** ⬜ chưa làm

## Bối cảnh
Khi dạy dùng Claude Code, mentor muốn biết member giao việc cho AI thế nào để góp ý đúng chỗ, thay vì đi kiểm tra từng máy. Story này dựng khung: buổi training, member vào bằng mã + tên + đồng ý, nhận cấu hình hook. Business: [PRODUCT.md §7.34](../PRODUCT.md), §7.16. Kết quả thử kỹ thuật: [spikes/claude-code-hooks.md](../spikes/claude-code-hooks.md).

## Quyết định của PO (2026-11-20)
Khái niệm riêng, không gắn Đề/Phiên. Hook HTTP chỉ trong `.claude/settings.local.json` của thư mục bài tập. Hai bước "Dừng thu" rồi "Kết thúc" (xoá dữ liệu). Member không xem được dữ liệu đã thu, chỉ thấy trạng thái kết nối.

## Phạm vi
Contract: `architecture.md` §2 (`trainings`, `training_members`, `training_events`), §5 "Buổi training AI" (mentor: tạo, danh sách, chi tiết khung, stop, end, mời ra; member: `resolve` bổ sung, `join`, `me`, `hook-config`, `DELETE me`), §5 quy tắc 5 (leak-guard), §11.8.

- **Server**
  - Migration cho cả 3 bảng (gồm `training_events`, để `end` và rút đồng ý xoá được; S33 mới ghi vào bảng này).
  - Domain `domain/training/`: `nextTrainingStatus`, `connectionState` (lúc này chỉ có `waiting`), `buildHookSettings`.
  - Bộ cấp mã phòng hiện có kiểm cả `trainings.room_code`. `POST /api/rooms/resolve` trả `kind`.
  - Use cases: `CreateTraining`, `ListTrainings`, `GetTrainingDetail` (chưa có số đếm sự kiện, cờ kẹt: trả 0/false), `StopTraining`, `EndTraining`, `RemoveTrainingMember`, `JoinTraining`, `GetMyTraining`, `GetHookConfig`, `WithdrawTrainingConsent`.
  - Route `training-routes.ts`: `trainingAdminRoutes`, `trainingMemberRoutes` (hook `requireTrainingMember`). `join` dùng chung bộ giới hạn lần sai mã với phiên.
  - `hook-config`: URL dựng từ Host của request; `mergePrompt` tiếng Việt, yêu cầu Claude Code **ghép** (không ghi đè) vào `.claude/settings.local.json` của thư mục hiện tại và không đụng `~/.claude/settings.json`.
  - leak-guard: quy tắc 5 của §5.
- **Không làm ở story này:** ingest (S33), dòng thời gian và chi tiết output (S34), mọi UI (S35, S36). Phát tín hiệu SSE `training` khi tạo, dừng, kết thúc, member vào/ra (bộ gộp ở S33).

## Acceptance criteria
- [ ] Mentor tạo buổi → `open` kèm mã 6 chữ số không trùng mã của phiên thi đang mở nào; danh sách mới nhất trước.
- [ ] `resolve` với mã của buổi `open` → `{ kind: 'training', id, title }`; mã phiên thi trả `kind: 'session'`; mã sai/buổi đã dừng → cùng lỗi 403 như cũ, tính vào giới hạn chung.
- [ ] `join` thiếu `consent: true` → 400; mã sai → 403; trùng tên (không phân biệt hoa thường) → 409 `identity_in_use`; buổi không `open` → 403 trung tính.
- [ ] `GET /api/training/me` chỉ trả trạng thái; quét key không có `prompt`, `toolTarget`, `summary`, `output`, `change`, `events`, `ingestToken`.
- [ ] `hook-config`: đúng 3 hook (`UserPromptSubmit`, `PostToolUse`, `PostToolUseFailure`), `type: 'http'`, `timeout: 1`, header `X-Training-Token`, URL theo Host của request; không có `Stop`. Buổi không `open` → 409.
- [ ] `stop`: `open` → `stopped`, mã phòng hết hiệu lực ngay; `end`: `stopped` → `ended`, xoá mọi member và sự kiện, giữ tên, thời gian, `memberCount`. Sai thứ tự → 409.
- [ ] Rút đồng ý / mời ra xoá member và mọi sự kiện của họ; token cũ → 401.
- [ ] `/api/admin/trainings*` từ máy khác trong LAN → 403 (như §4).

## Test
- Domain: `domain/training/*.test.ts` (chuyển trạng thái, `buildHookSettings`).
- Use case: `application/use-cases/training/*.test.ts` với fakes trong `application/testing/`.
- Tích hợp HTTP: `test/integration/training.test.ts` (luồng tạo → join → hook-config → stop → end; mã trùng giữa phiên và training; quét key cấm; 403 từ máy khác).

## Giới hạn đã biết / chưa làm
- Không duyệt người vào (không có điểm, không có gì để gian lận); mentor mời ra được.
- Không mở thu lại sau khi dừng.
