# S19 — Xin sửa bài tự luận sau khi nộp

**Phụ thuộc:** S11, S12, S09 · **Trạng thái:** ✅ xong (2026-11-16)

## Bối cảnh
Bài tự luận dài: member nộp rồi mới muốn bổ sung. Luật "1 lượt" (PRODUCT.md §4.4) giữ nguyên, nhưng cho một ngoại lệ có kiểm soát: xin mentor mở lại **phần tự luận**. Business: [PRODUCT.md §7.21](../PRODUCT.md). Contract: [architecture.md §2 (`attempts.edit_*`), §5, §8](../architecture.md).

Đã cân nhắc và **bỏ**: tạm dừng phiên để thảo luận giữa chừng (đáp án chỉ hiện sau `CLOSED`, bản nháp không đưa ra thảo luận → không còn việc để làm khi pause).

## Phạm vi
- **Member**: ở màn kết quả sau khi nộp (phiên `running`), nút "Xin sửa bài tự luận" → nhập lý do (bắt buộc, ≤ 500 ký tự) → trạng thái "Đang chờ mentor". Bị từ chối → thấy thông báo và gửi lại được. Được duyệt → hiện các câu tự luận để sửa (autosave), trắc nghiệm không hiện/không sửa được; nút "Xong, lưu bài" đóng việc sửa.
- **Mentor**: chuông có loại "xin sửa bài" (nổi bật, kèm lý do, Duyệt/Từ chối ngay trong chuông); trang điều khiển phiên hiện cùng thông tin ở dòng người đó.
- **API**: xem architecture §5. `progress.editRequest` trong chi tiết phiên của mentor; `editRequest` trong `/api/me` và `AttemptView` của member.

## Quy tắc
- Chỉ phiên `running`. `closed` → yêu cầu tự hết hiệu lực (suy ra khi đọc, không ghi).
- Mỗi lượt: một yêu cầu `pending` cùng lúc; `rejected` → gửi lại được (ghi đè); đã `approved`/`done` → không xin thêm.
- Lưu câu trắc nghiệm của lượt đã nộp luôn 409. Điểm tự động, `submitted_at`, xếp hạng không đổi.
- Member kicked/pending không xin được; mentor không duyệt được yêu cầu của phiên khác (404).

## Ngoài phạm vi
Lịch sử yêu cầu bị từ chối; thông báo desktop riêng; sửa trắc nghiệm; số lần duyệt > 1.

## Acceptance criteria
- [x] Xin được khi đã nộp + `running`; 409 khi chưa nộp / `closed` / đã có yêu cầu chờ hoặc đã duyệt; lý do rỗng → 400.
- [x] Duyệt/từ chối đúng quyền, chỉ khi `pending`; member nhận trạng thái mới qua SSE (`participants`) / poll.
- [x] Sau duyệt: lưu được câu tự luận, không lưu được trắc nghiệm; hoàn tất → `done`; điểm tự động không đổi.
- [x] Chuông mentor hiện yêu cầu, duyệt/từ chối trong chuông được.
- [x] `npm test`, `npm run typecheck`, `npm run arch:check` pass.

## Đã thao tác tay (Playwright, 2 member, 1280×800)
Member nộp bài (phiên `running`) → "Xin sửa bài tự luận" → bấm gửi khi lý do trống: báo "Hãy ghi lý do xin sửa bài" → gửi có lý do → thẻ "Đã gửi yêu cầu sửa bài" → mentor thấy chấm vàng + số trên chuông, dòng vàng ở trang điều khiển phiên (lý do dài xuống dòng đúng chỗ) → Từ chối trong chuông → member thấy cảnh báo bị từ chối và nút "Gửi lại yêu cầu sửa bài" → gửi lại → mentor Duyệt ở trang điều khiển → member thấy ô sửa **chỉ câu tự luận** (không có phương án trắc nghiệm), "Đã lưu" → "Xong, lưu bài" → "Bạn đã sửa bài tự luận". API: trắc nghiệm sau khi duyệt vẫn 409, điểm tự động không đổi (test `edit-request.test.ts`).

## Ghi chú khi làm
- Yêu cầu lưu ngay trên `attempts` (`edit_*`), không thêm bảng: mỗi lượt chỉ có một yêu cầu sống, nên không cần lịch sử. Hệ quả: gửi lại sau khi bị từ chối **ghi đè** lý do cũ.
- `expired` suy ra khi đọc (yêu cầu `pending`/`approved` mà phiên không còn `running`), không ghi DB và không cần việc nền khi đóng phiên.
- Chuông: loại thông báo `edit` có khoá `edit:<participantId>:<requestedAt>`, nên yêu cầu gửi lại tính là thông báo mới (chưa xem). Dấu chấm vàng/badge tính cả người chờ duyệt lẫn yêu cầu sửa bài đang chờ.
- Không có event SSE mới: dùng `participants`. Member cập nhật qua poll/SSE sẵn có của `/api/me`.
