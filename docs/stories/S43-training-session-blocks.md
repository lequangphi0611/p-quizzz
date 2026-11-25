# S43: Training: gom theo phiên Claude Code (kể cả song song) và đánh dấu prompt mới

**Phụ thuộc:** S39, S41, S42 · **Trạng thái:** ⏳ (spec xong 2026-11-25; **phần UI chờ thiết kế**, xem [prompt designer](../design/S43-training-session-blocks-ui-prompt.md))

## Bối cảnh
Member có thể mở nhiều phiên Claude Code cùng lúc trong thư mục bài tập. Mã hiện tại coi các phiên nối tiếp nhau. Ví dụ `buildTimeline` (`src/web/features/training-admin/domain/timeline.ts`): mỗi khi `claudeSessionId` của sự kiện kế tiếp khác sự kiện trước, nó chèn một dải "Phiên N · mở lúc" và mở một lượt mới. Khi hai phiên xen nhau thì:
- dải "mở phiên" lặp lại ở mỗi lần chuyển, "mở lúc" ghi giờ chuyển chứ không phải giờ mở;
- lệnh bị tách khỏi prompt đã sinh ra nó và rơi vào lượt "không có prompt".

Cùng lỗi gốc đó ở server: `inferPermissionDecision` coi một prompt của phiên khác là "đã đi tiếp", nên suy ra "từ chối" sai. `repeatedFailure`, `repeatedRequest`, `autoCompactRepeated`, `isStuck` và `markRuns` ở web đều đọc chuỗi sự kiện của cả member. `buildMemberFile` (`src/server/domain/training/export.ts`) in mốc phiên mỗi lần `claudeSessionId` đổi.

Business: [PRODUCT.md §7.38](../PRODUCT.md) (a)–(f). Hành vi ngày của §7.37 / S42 giữ nguyên trừ chỗ §7.38 nói khác.

## Phạm vi

### Phần 1: dữ liệu đúng (làm được ngay, không chờ thiết kế)
**Contract**: không đổi API công khai hay schema. Port nội bộ đổi như dưới đây, cập nhật `docs/architecture.md` §11.8/§11.9 trong cùng story.

- **Server, cờ** (`src/server/domain/training/flags/`):
  - Các hàm dựa trên chuỗi liên tiếp chạy **riêng trên từng phiên**: `repeatedFailure`, `repeatedRequest`, `autoCompactRepeated`, `inferPermissionDecision` (kéo theo `fastApprovals`). Cách gợi ý: tách `events` theo `claudeSessionId` (giữ thứ tự cũ → mới), chạy quy tắc trên từng nhóm rồi gộp `eventIds`. Một cờ bật khi bật ở ít nhất một phiên.
  - `longWithoutVerify`, `editedNotVerified` **giữ nguyên trên cả member** (thư mục dùng chung, §7.38c). Ghi chú lý do ngay cạnh hàm.
  - `autoAccept`, `dangerousCommand`, `touchesTests`, `possibleSecret` không đổi.
- **Server, kẹt** (`domain/training/is-stuck.ts` và chỗ gọi trong `application/use-cases/training/admin.ts`): member "có thể đang kẹt" khi **ít nhất một phiên** có `STUCK_REPEAT` công cụ gần nhất của phiên đó cùng thất bại với cùng `toolTarget`. Đổi port `recentTools(memberId, n)` cho phù hợp, theo một trong hai cách: trả `n` công cụ gần nhất của mỗi phiên, hoặc bỏ port này và tính từ danh sách sự kiện mà `flagsOf` đã đọc. Ghi lựa chọn vào architecture §11.8.
- **Server, zip** (`domain/training/export.ts`, `buildMemberFile`): dòng thời gian từng member nhóm theo **ngày → phiên → prompt**.
  - Trong mỗi ngày, mỗi phiên là một mục `#### Phiên Claude Code N · HH:MM–HH:MM · <kết thúc>`. Số phiên theo thứ tự xuất hiện trong cả buổi, giống web. Bỏ kiểu `session.slice(0, 8)`.
  - Mọi sự kiện đi theo prompt của cùng phiên.
  - Mức tiêu đề prompt hạ một cấp cho khớp.
  - `00-tong-quan.md` có thêm một câu giải thích cách nhóm.
  - Ngày của một lượt theo ngày của prompt (cùng quy tắc §7.37a). Hiện file đang tách theo ngày của từng sự kiện, sửa luôn.
- **Server, báo cáo** (`report.ts`): ví dụ đã đánh dấu vẫn lấy đúng prompt và công cụ của cùng phiên. Kiểm lại, sửa nếu đang lấy theo "prompt gần nhất của member".
- **Web, domain** (`features/training-admin/domain/`):
  - `buildTimeline` gắn mỗi sự kiện vào lượt đang mở **của cùng phiên** (giữ một "lượt hiện tại" cho từng `claudeSessionId`). Không bao giờ tạo lượt không có prompt chỉ vì phiên khác vừa chen vào. Lượt "Trước prompt đầu tiên" chỉ có khi chính phiên đó có lệnh trước prompt đầu tiên của nó.
  - `markRuns` (chip lặp lệnh lỗi) chạy theo phiên.
  - Hàm thuần mới gom một ngày thành **khối phiên** (cấu trúc gợi ý ở cuối phần này).
  - Số phiên đánh theo cả buổi (thứ tự sự kiện đầu tiên); số prompt đánh theo cả buổi.
  - `overlapsWith`: các phiên khác có khoảng giờ trong ngày chồng lên khoảng giờ của khối này.
  - `endedBy`: lấy từ sự kiện `session` `subtype` `clear` / `exit` cuối cùng của phiên đó, xét trên **cả buổi**, không chỉ ngày đang xét. Phiên kéo qua đêm có thể kết thúc ở ngày sau: khối của ngày trước vẫn ghi "tiếp tục sang dd/mm" thay vì "chưa kết thúc" (cách ghi theo thiết kế).
  - `day-groups.ts` dùng các khối này. Số đếm ngày phải bằng tổng các khối, tính từ cùng một phép gom.

Cấu trúc khối phiên gợi ý:

```ts
type SessionBlock = {
  key: string;
  index: number;
  claudeSessionId: string;
  firstAt: number;
  lastAt: number;
  continuedFrom?: number;
  endedBy: 'clear' | 'exit' | null;
  overlapsWith: number[];
  prompts: number;
  commands: number;
  failed: number;
  turns: Turn[];
};
```

Các khối trong một ngày xếp theo `firstAt` cũ → mới; lượt trong khối xếp cũ → mới.

### Phần 2: giao diện (**chờ thiết kế được PO duyệt**; khi có thiết kế, main session bổ sung mục "Thiết kế" vào story này trước khi giao)
- **Khối phiên** trong ngày, thay cho dải phiên hiện tại (`SessionMarker`):
  - Tiêu đề là nút (`aria-expanded`, `aria-controls`). Nội dung tiêu đề: "Phiên Claude Code N", khoảng giờ, tóm tắt (bỏ lỗi khi 0), cách kết thúc, "song song với phiên M".
  - Mặc định mở khi khối có mục chưa đọc hoặc `endedBy === null`; còn lại thu.
  - Chọn member khác thì về mặc định. Khối mới (phiên mới) thì tự mở, các khối khác giữ nguyên.
  - Ngày chỉ có một phiên thì dùng biến thể nhẹ theo thiết kế.
- **Tự mở khi nhảy tới**: `jumpToFlag`, J/K (`stepEvent`), `openTurn`, chip "N mới" tới sự kiện trong khối đang thu (và/hoặc ngày đang thu) thì mở cả hai rồi mới cuộn. J/K đi theo **thứ tự đang hiển thị** (ngày như S42, trong ngày theo khối rồi theo lượt), không theo id sự kiện.
- **Đánh dấu mới** (`§7.38d`):
  - **Đơn vị**: một lượt (prompt + mọi sự kiện của nó). Lượt **chưa đọc** khi có sự kiện có `id` lớn hơn mốc đã đọc của lượt đó và lớn hơn mốc ban đầu của member.
  - **Lưu**: port mới trong feature, ví dụ `TrainingReadStore`, adapter `localStorage`, không bao giờ throw (theo kiểu `local-storage-seen-store.ts` của `mentor-notices`). Key `pq:mentor:training-read:<trainingId>`. Giá trị gợi ý: `{ members: { [memberId]: { baselineAt, baselinePromptCount, turns: { [turnKey]: maxReadEventId } } } }`, trong đó `turnKey` là id sự kiện prompt (lượt không có prompt: id sự kiện đầu). Thêm key vào bảng localStorage trong architecture.
  - **Mốc ban đầu**: lần đầu trình duyệt thấy một member trong danh sách (chưa có bản ghi), lấy `baselineAt = lastSeenAt` (giờ server) và `baselinePromptCount = promptCount` của `TrainingMemberRow`. Sự kiện có `receivedAt ≤ baselineAt` coi là đã đọc.
  - **Đọc**: một lượt nằm trong khung cuộn của dòng thời gian (ví dụ ≥ 50% chiều cao, hoặc phủ ≥ 50% khung nếu lượt cao hơn khung) **liền 2 giây**, trong lúc tab đang hiện (`document.visibilityState`), không ẩn nội dung, ngày và khối của nó đang mở. Khi đủ, ghi `maxReadEventId` = id sự kiện lớn nhất của lượt **tại thời điểm bắt đầu đếm**. Sự kiện tới trong 2 giây đó vẫn là mới. Dùng `IntersectionObserver` hoặc tương đương; logic hẹn giờ tách thành hàm hoặc lớp có test với đồng hồ giả.
  - **"Đánh dấu đã đọc hết"**: đặt ở hàng thông tin học viên (theo thiết kế), đánh dấu mọi lượt **đã tải** của member đang xem, đồng thời nâng `baselinePromptCount` cho đúng.
  - **Số ở danh sách member** (`MembersTable`): số prompt mới chưa đọc = `promptCount − baselinePromptCount − (số prompt sau mốc đã đọc)`, không âm. Bằng 0 thì không hiện gì. Sự kiện mới trong prompt cũ không cộng vào.
  - **Ngày hoặc khối đang thu** hiện "N mới" (số lượt chưa đọc trong đó).
  - **Chip "N sự kiện mới" của S42**: điều kiện hiện vẫn như S42 (có sự kiện mới khi không theo dõi). Con số là **số lượt chưa đọc** mà các sự kiện mới đó rơi vào; bấm thì tới lượt chưa đọc mới nhất trong số đó. Đổi chữ theo thiết kế.
  - **Ẩn nội dung**: không hiện và không đếm đọc.
  - **Dọn**: trang buổi đã `ended` thì xoá key của buổi. Trang danh sách buổi xoá key của những buổi không còn hoặc đã kết thúc.
- **Ảnh** `docs/design/S43-assets/` theo các frame của thiết kế.

## Ngoài phạm vi
- Lưu trạng thái đã đọc trên server, chia sẻ giữa nhiều trình duyệt.
- Công tắc "theo ngày / theo phiên", hay bản xem làn song song.
- Thanh lọc, xem prompt của cả lớp theo ngày (§7.37 "Chưa làm").
- Phát hiện các phiên sửa đè lên nhau.
- Đổi API dòng thời gian, phân trang hay luồng SSE.

## Acceptance criteria
### Phần 1
- [ ] Hai phiên xen nhau (A prompt, B prompt, A lệnh, B lệnh, A lệnh): mỗi lệnh nằm dưới prompt của đúng phiên, không có lượt "không có prompt", mỗi phiên chỉ có một mục mở phiên.
- [ ] Yêu cầu quyền ở phiên A, rồi prompt ở phiên B, rồi công cụ khớp chạy ở A: suy ra "cho phép" (trước đây "từ chối"). Không có gì tiếp theo ở A: "đang chờ".
- [ ] `npm test` lỗi 3 lần ở phiên A xen với lệnh thành công ở phiên B: cờ lặp lệnh lỗi và "có thể đang kẹt" vẫn bật. Lỗi 2 lần ở A và 1 lần ở B: không bật.
- [ ] Sửa file ở phiên A, chạy test thành công ở phiên B: **không** có cờ "sửa xong chưa chạy kiểm tra".
- [ ] Lặp yêu cầu và nén tự động nhiều lần được xét trong từng phiên.
- [ ] Zip: file member nhóm ngày → phiên → prompt; số phiên khớp web; lượt qua nửa đêm nằm ở ngày của prompt.
- [ ] Báo cáo: ví dụ đã đánh dấu đi kèm đúng prompt cùng phiên.
- [ ] Khối phiên (domain): đúng thứ tự, khoảng giờ, tóm tắt, `endedBy`, `overlapsWith`, "tiếp từ dd/mm" khi qua đêm. Số đếm ngày bằng tổng các khối.
### Phần 2 (sau thiết kế)
- [ ] Khối phiên hiển thị và mở/thu đúng mặc định; `aria-*` và bàn phím như thiết kế.
- [ ] Chip cờ, J/K, mở chi tiết, "N mới" tới sự kiện trong khối hoặc ngày đang thu thì cả hai tự mở. J/K theo thứ tự hiển thị.
- [ ] Lượt mới, hoặc lượt cũ có sự kiện mới, nổi bật (không chỉ bằng màu). Nằm trong khung 2 giây thì hết; dưới 2 giây hoặc tab ẩn thì chưa hết.
- [ ] Sự kiện tới trong lúc đang đếm 2 giây vẫn nổi bật sau khi lượt được đánh dấu đọc.
- [ ] Lần đầu mở buổi trên một trình duyệt: không có gì nổi bật. Sự kiện tới sau thì có.
- [ ] F5 giữ trạng thái đã đọc. `localStorage` lỗi hoặc bị chặn thì trang vẫn chạy (coi như lần đầu).
- [ ] Danh sách member hiện đúng số prompt mới chưa đọc. Ngày/khối đang thu hiện "N mới". "Đánh dấu đã đọc hết" xoá hết nổi bật của member đó.
- [ ] Chip "N sự kiện mới" đếm theo lượt chưa đọc.
- [ ] Ẩn nội dung: không lộ nổi bật hay số mới trong dòng thời gian, không đếm đọc.
- [ ] Buổi đã kết thúc thì key `localStorage` của buổi bị xoá.
- [ ] `npm run typecheck`, `npm test` (gồm `arch:check`) pass; `npm run e2e` không có lỗi mới.

## Test
- Server domain: test cho từng cờ đổi sang theo phiên, gồm ca hai phiên xen nhau (dùng `flags/test-events.ts`, thêm tham số `claudeSessionId`). Test `inferPermissionDecision` cho ca xen phiên. Test `isStuck` theo phiên. Test `buildMemberFile` nhóm ngày → phiên → prompt và lượt qua nửa đêm.
- Web domain: `timeline.test.ts` thêm ca xen phiên (đúng prompt, không có lượt rỗng, một mục mở phiên mỗi phiên). Test hàm khối phiên (thứ tự, khoảng giờ, overlap, `endedBy` qua đêm). Test hàm thuần "chưa đọc" (mốc ban đầu, mốc theo lượt, số ở danh sách member). Test bộ đếm 2 giây với đồng hồ giả.
- Infrastructure: adapter `localStorage` không throw khi bị chặn hoặc dữ liệu hỏng.
- E2E (phần 2): mở rộng `e2e/training-multi-day.spec.ts` hoặc file mới `e2e/training-sessions.spec.ts`. Gửi JSON hook giả của hai phiên xen nhau, kiểm khối phiên, nổi bật biến mất sau khoảng 2 giây trong khung, số ở danh sách member, F5 giữ trạng thái. Chụp ảnh vào `docs/design/S43-assets/`.

## Module bị chạm
`src/server/domain/training/{flags,is-stuck.ts,export.ts,report.ts}`, `src/server/application/{ports/training-event-repository.ts,use-cases/training/admin.ts}`, `src/server/infrastructure/db/drizzle-training-event-repository.ts` (nếu đổi port), `src/web/features/training-admin/{domain,application,infrastructure,ui}`, `docs/architecture.md` §11.8–11.9, test tương ứng, `e2e/`.

## Thứ tự làm gợi ý
Phần 1 làm và review được trước, có thể thành PR riêng. Phần 2 chỉ bắt đầu khi thiết kế đã được PO duyệt và story có mục "Thiết kế".
