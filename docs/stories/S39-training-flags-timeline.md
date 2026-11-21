# S39: Training: cờ gợi ý và các dòng mới trên dòng thời gian

**Phụ thuộc:** S37 · **Trạng thái:** ✅ xong (2026-11-21)

## Bối cảnh
Mentor cần nhận ra member cần góp ý ở bốn nhóm (kiểm chứng, cách giao việc, kẹt, rủi ro) và thấy đủ các sự kiện mới thu ở S37. Business: [PRODUCT.md §7.35](../PRODUCT.md) (b), (c), (d).

## Phạm vi
Contract: `architecture.md` §11.9 (Cờ gợi ý).

- **Server**
  - `domain/training/flags/`: mỗi cờ ở §7.35c là một hàm thuần; thêm `isVerifyCommand` và `inferPermissionDecision`.
  - `trainings.allow_auto_accept`, đặt ở form tạo buổi.
  - `GetTrainingDetail` trả cờ, số đếm và `flagCounts`.
  - `ListMemberEvents` trả `flags` và quyết định suy ra cho mỗi dòng xin quyền.
- **Web mentor**
  - Form tạo buổi có ô "Cho phép chế độ tự chấp nhận".
  - Dòng thời gian thêm các dòng mới:
    - phiên Claude mới (/clear);
    - nén hội thoại;
    - đổi model;
    - Claude xin quyền → đã cho sau ~Ns / không cho (ghi "suy ra");
    - Claude hỏi → member chọn;
    - kế hoạch đã trình, kèm nút "Xem";
    - Claude chờ member.
  - Chip cờ trên bảng member. Bấm chip thì nhảy tới sự kiện căn cứ.
  - Khối tổng hợp lớp chỉ hiện số đếm.
- Tên cờ mô tả hành vi, không mô tả người. Câu chữ hiển thị chốt trong story này.

## Acceptance criteria
- [x] Mỗi cờ có test cho cả ca có cờ và ca không có cờ. Ngưỡng ghi trong story khi chốt.
- [x] `isVerifyCommand` nhận `npm test`, `npm run build`, `pnpm lint`, `npx vitest`, `pytest`, `go test ./...`, `cargo test`, `mvn test`, `gradle build`, `dotnet test`, `tsc --noEmit` và dạng PowerShell tương đương. Không nhận `ls`, `cat`, `git status`.
- [x] `inferPermissionDecision`: có công cụ khớp chạy trước prompt kế tiếp → `allowed` kèm `decisionMs`; không có → `denied`; đang chờ → `pending`.
- [x] Buổi có `allow_auto_accept` không hiện cờ chế độ tự chấp nhận.
- [x] Tổng hợp lớp không chứa tên. Có test quét key.
- [x] E2E: các dòng mới hiển thị đúng; chip cờ nhảy tới sự kiện căn cứ. Ảnh chụp vào `docs/design/S39-assets/`.

## Test
- Domain: một file test cho mỗi cờ, `is-verify-command.test.ts`, `infer-permission-decision.test.ts`.
- Tích hợp HTTP: chi tiết buổi và dòng thời gian có cờ.
- E2E: `e2e/training-admin.spec.ts`.

## Giới hạn đã biết
- "Sửa xong chưa chạy kiểm tra" là gợi ý mờ, vì lệnh chạy ngoài Claude thì app không thấy.
- `decisionMs` có sai số do mạng.

## Đã làm (ghi chú)
- Ngưỡng đã chốt (hằng số đặt cạnh từng hàm trong `domain/training/flags/`):
  - Lặp lệnh lỗi: cùng đích 3 lần lỗi liên tiếp.
  - Lâu chưa qua kiểm tra: từ 5 lần sửa file trong ít nhất 10 phút, chưa có lần kiểm tra thành công.
  - Sửa xong chưa chạy kiểm tra: 2 lượt (giữa hai prompt) có sửa file mà không chạy kiểm tra nào (kể cả lỗi).
  - Chế độ tự chấp nhận: `acceptEdits`, `bypassPermissions`, `dontAsk`, `auto`.
  - Đồng ý quyền rất nhanh: 3 lần dưới 2 giây.
  - Lặp yêu cầu: 3 prompt liền, giống nhau từ 80% số từ hoặc chỉ ngắn gọn báo "vẫn lỗi".
  - Nén tự động nhiều lần: 2 lần không có `/clear`.
- Cờ **tính lúc đọc**, không lưu. `GetTrainingDetail` giữ kết quả theo `lastEventId` của từng member để không tính lại khi không có sự kiện mới.
- `quyết định suy ra`: `denied` khi lượt đã đi tiếp (prompt mới, công cụ khác, `/clear`) mà công cụ không chạy; `pending` khi chưa có gì sau yêu cầu. Màn mentor tải lại từ dòng `pending` cũ nhất để cập nhật câu trả lời.
- `repeated_failure` không hiện trên chip khi member đang "Có thể đang kẹt" (hai chip nói gần như cùng một điều).
- `possible_secret` dùng `domain/training/secrets.ts`; S40 dùng lại mẫu này để che chữ.
- Giới hạn chữ cờ đọc: 4 000 ký tự nội dung sửa và output (cắt trong SQL).
- Ảnh: `docs/design/S39-assets/`.
