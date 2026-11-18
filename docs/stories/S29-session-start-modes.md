# S29 — Bắt đầu phiên: thủ công, hẹn giờ hoặc khi mọi người sẵn sàng

**Phụ thuộc:** S09, S10, S12, S14, S18, S20, S21, S25 · **Trạng thái:** ⬜ chưa làm

## Bối cảnh
Mentor không muốn canh đồng hồ để bấm Bắt đầu, nhất là khi chạy nhiều phòng song song. Member muốn biết khi nào bắt đầu và không bị mất giờ làm bài chỉ vì một bước bấm thừa ở màn "Bắt đầu làm bài". Business: [PRODUCT.md §7.31](../PRODUCT.md), §4.2, §7.27d/g, §7.20, §7.24. Contract hiện tại: [architecture.md](../architecture.md) §2 (`sessions`, `participants`), §3 (`lobby → running`), §5, §7.

## Quyết định của PO (2026-11-18)
- Có **ba cách bắt đầu**, cách nào đến trước thì chạy: mentor bấm "Bắt đầu ngay", đến giờ hẹn, hoặc mọi người sẵn sàng. Cách cuối do mentor tự bật, mặc định tắt, kèm số người tối thiểu.
- "Bắt đầu ngay" và "mọi người sẵn sàng" chạy qua **đếm ngược 10 giây** (cố định, không chỉnh được). Đếm ngược đã chạy thì khoá, chỉ mentor huỷ được.
- Luật làm bài chuyển lên phòng chờ. Phiên chạy thì mọi người có mặt **vào thẳng câu 1** (mọi phiên). Chỉ người vào trễ còn thấy một màn ngắn "còn X phút".
- Máy mentor chạy lại khi đã quá giờ hẹn thì **không tự chạy**: phiên chuyển về bắt đầu thủ công và mentor được báo.

## Phạm vi
**Server**
- Lưu giờ bắt đầu dự kiến của phiên và **nguồn** của nó (hẹn giờ / bắt đầu ngay / mọi người sẵn sàng); cấu hình "tự bắt đầu khi sẵn sàng" và số người tối thiểu; mốc sẵn sàng của từng participant.
- Use case: hẹn / đổi / bỏ giờ (`draft`, `lobby`); bắt đầu ngay (đặt giờ = now + 10 s, khoá); huỷ đếm ngược (mentor); sẵn sàng / huỷ sẵn sàng (member, chỉ ở `lobby`, khi chưa đếm ngược); bật/tắt tự bắt đầu khi sẵn sàng và số tối thiểu (`draft`, `lobby`).
- Đánh giá điều kiện "mọi người sẵn sàng" (§7.31e) **trong unit of work** mỗi khi có sẵn sàng/huỷ, duyệt, kick, vào phòng, đổi cấu hình. Đủ điều kiện thì đặt đếm ngược 10 s.
- Bộ hẹn giờ: mở rộng `deadline-watcher` (hoặc thêm một watcher song song cùng khuôn) để chạy `StartDueSessions` mỗi giây, đi qua **đúng luồng `start`** hiện có (đặt `ends_at` theo §7.27 từ lúc thực sự bắt đầu). Kiểm tra lại trong UoW để "Huỷ", "Đổi giờ" hay "Bắt đầu ngay" đến trước thì thắng.
- Lần chạy lúc khởi động: giờ hẹn đã quá thì bỏ (không start), ghi lại để chuông mentor báo (§7.31b, g).
- `/api/me` và DTO phòng chờ trên màn chiếu: giờ bắt đầu, `remainingMs` tới lúc bắt đầu, nguồn bắt đầu (để hiện "Bắt đầu sớm", "Giờ đã đổi"), `ready { count, total }`, cờ của chính mình đã sẵn sàng chưa. **Không bao giờ** trả tên người chưa sẵn sàng ra API công khai/member.
- `/api/me` cho biết participant có phải **người vào trễ** không (được duyệt/vào sau `started_at`) để web chọn: vào thẳng câu 1 hay hiện màn "còn X phút".

**Web**
- Mentor (trang điều khiển phiên, form tạo phiên): thẻ "Bắt đầu" gồm hẹn giờ (chọn giờ, đổi, bỏ), bật "Tự bắt đầu khi tất cả sẵn sàng" + tối thiểu N (phiên nhóm mặc định = số email), "Bắt đầu ngay" (xác nhận cảnh báo khi bắt đầu trước giờ hẹn mà phiên có giới hạn thời gian), "Huỷ đếm ngược". Danh sách người có cột/nhãn sẵn sàng, dòng lý do khi chưa tự chạy được ("đang chờ duyệt 2 người", "mới 3/5 sẵn sàng", "cần tối thiểu 8 người").
- Chuông (§7.20): "Phòng … sắp tự bắt đầu, còn N người chờ duyệt" (khi còn 1 phút tới giờ hẹn) và "Giờ hẹn của phòng … đã bị bỏ vì máy khởi động lại sau giờ hẹn".
- Member, phòng chờ: luật làm bài, nút Sẵn sàng / Huỷ sẵn sàng, "Sẵn sàng X/Y", dòng cách bắt đầu, đếm ngược tới giờ hẹn, đếm ngược 10 s, thông báo đổi giờ / bắt đầu sớm / huỷ đếm ngược. Tách rõ trạng thái **chờ duyệt** với **chờ bắt đầu**. Hết đếm ngược thì **tự bắt đầu lượt** và vào câu 1, không qua `StartScreen`. `StartScreen` chỉ còn dùng cho người vào trễ ("Phiên đã bắt đầu, bạn còn X phút").
- Màn chiếu (phòng chờ): giờ bắt đầu + đếm ngược (nhìn khác đồng hồ làm bài), "Sẵn sàng X/Y", đếm ngược 10 s lớn, thông báo đổi giờ / bắt đầu sớm.
- UI theo bản thiết kế từ [prompt designer](../design/S29-session-start-ui-prompt.md). Phần mentor dùng lại component sẵn có.

## Contract đề xuất (chốt khi implement; sửa `architecture.md` cùng commit, §2, §3, §5, §7)
- `sessions`: `starts_at?` (timestamp_ms), `start_source?` (`schedule`\|`now`\|`ready`), `auto_start_ready` (bool, mặc định false), `ready_min?` (int ≥ 1), `start_schedule_dropped_at?`.
- `participants`: `ready_at?`.
- Mentor: `PUT /api/admin/sessions/:id/start-schedule` `{ startsAt: number | null }`; `POST /sessions/:id/start` đổi nghĩa thành **đặt đếm ngược 10 s** (giữ endpoint, không thêm); `POST /sessions/:id/cancel-countdown`; `PUT /sessions/:id/auto-start` `{ enabled, minParticipants }`. Sai trạng thái → 409. Phát `session`.
- Member: `PUT /api/me/ready` `{ ready: boolean }`. Phát `participants`.
- Hằng số `START_COUNTDOWN_MS = 10_000` trong `src/shared/`.
- Bản implement có thể chọn tên khác, miễn là ghi rõ trong `architecture.md`.

## Acceptance criteria
- [ ] Không hẹn giờ và không bật sẵn sàng: mentor bấm "Bắt đầu ngay" → đếm ngược 10 s → `running`. Không còn bước "Bắt đầu làm bài" với người có mặt.
- [ ] Hẹn giờ: đến giờ (đồng hồ server) thì `running`, không thêm 10 s. Đổi giờ / bỏ hẹn có hiệu lực ngay, member và màn chiếu thấy cập nhật kèm thông báo. Không đặt được giờ ở quá khứ.
- [ ] Tự bắt đầu khi sẵn sàng: chỉ kích hoạt khi đã bật, Y ≥ N, cả Y sẵn sàng, không ai chờ duyệt. Y gồm người đã duyệt, đang trong phòng, kể cả rớt mạng. 1/1 khi chưa bật **không** chạy.
- [ ] Ba cách đua nhau: cách nào đến trước thì thắng, không bao giờ start hai lần. Đếm ngược đang chạy: huỷ sẵn sàng hay có người mới vào **không** dừng nó. Mentor huỷ thì quay về chờ.
- [ ] `ends_at` = lúc thực sự `running` + giới hạn (§7.27d).
- [ ] Server khởi động khi đã quá giờ hẹn: phiên vẫn `lobby`, giờ hẹn bị bỏ, chuông mentor báo.
- [ ] Người vào trễ thấy màn "còn X phút"; người có mặt lúc bắt đầu vào thẳng câu 1. F5 trong lúc đếm ngược vẫn giữ đúng thời điểm.
- [ ] Không lộ: API member/công khai không trả tên người chưa sẵn sàng, tên phiên, tên nhóm, ai chờ duyệt. Trước `running` không có câu hỏi nào được trả (giữ quy tắc §5 "không lộ đáp án").
- [ ] Hẹn giờ và sẵn sàng của phiên này không ảnh hưởng phiên song song khác.

## Test
- Domain: quy tắc điều kiện sẵn sàng, chọn nguồn thắng, đếm ngược khoá, bỏ giờ hẹn quá hạn lúc khởi động.
- Use case: hẹn/đổi/bỏ, bắt đầu ngay, huỷ, sẵn sàng/huỷ, `StartDueSessions` (dùng đồng hồ giả qua port `Clock`).
- Integration (HTTP): luồng đủ ba cách; 409 ở sai trạng thái; API member không chứa tên người khác; đua "huỷ" với watcher.
- Web: controller phòng chờ (tự bắt đầu lượt khi hết đếm ngược, người vào trễ).
- E2E: hẹn giờ vài giây tới và chờ thật; "Bắt đầu ngay" thấy đếm ngược 10 s trên member và màn chiếu. Ảnh ở `docs/design/S29-assets/`.

## Giới hạn đã biết / chưa làm
- Đồng hồ máy member/tường có thể lệch với máy mentor; UI luôn hiện đếm ngược.
- Laptop mentor ngủ thì không có gì tự chạy.
- Chưa làm: tự mở phòng chờ theo giờ; âm thanh/rung khi bắt đầu; chỉnh độ dài đếm ngược.
