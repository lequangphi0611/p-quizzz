# S43: Training: gom theo phiên Claude Code (kể cả song song) và đánh dấu prompt mới

**Phụ thuộc:** S39, S41, S42 · **Trạng thái:** ✅ (2026-11-25, review 3 vòng + kiểm lần cuối; còn 2 AC ghi chú bên dưới; [prompt designer](../design/S43-training-session-blocks-ui-prompt.md), [thiết kế](../design/S43-design/))

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

### Phần 2: giao diện (theo mục **Thiết kế** ở cuối story; chỗ nào mục đó nói khác thì theo mục đó)
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
  - **Đọc**: một lượt nằm trong khung cuộn của dòng thời gian (ví dụ ≥ 50% chiều cao, hoặc phủ ≥ 50% khung nếu lượt cao hơn khung) **liền 2 giây**, trong lúc tab đang hiện (`document.visibilityState`) **và cửa sổ đang được chọn** (`document.hasFocus()`, nghe `focus`/`blur`), không ẩn nội dung, ngày và khối của nó đang mở. Khi đủ, ghi `maxReadEventId` = id sự kiện lớn nhất của lượt **tại thời điểm bắt đầu đếm**. Sự kiện tới trong 2 giây đó vẫn là mới. Dùng `IntersectionObserver` hoặc tương đương; logic hẹn giờ tách thành hàm hoặc lớp có test với đồng hồ giả.
  - **"Đánh dấu đã đọc hết"**: đặt ở hàng thông tin học viên (theo thiết kế), đánh dấu mọi lượt **đã tải** của member đang xem, đồng thời nâng `baselinePromptCount` cho đúng.
  - **Số ở danh sách member** (`MembersTable`): số prompt mới chưa đọc = `promptCount − baselinePromptCount − (số prompt sau mốc đã đọc)`, không âm. Bằng 0 thì không hiện gì. Sự kiện mới trong prompt cũ không cộng vào.
  - **Ngày hoặc khối đang thu** hiện "N mới" (số lượt chưa đọc trong đó).
  - **Chip "N sự kiện mới" của S42**: điều kiện hiện vẫn như S42 (có sự kiện mới khi không theo dõi). Chữ đổi thành **"N prompt có mục mới"**; con số là số lượt chưa đọc nằm ngoài khung nhìn, ở mép phía có chúng; bấm thì tới lượt gần nhất trong số đó.
  - **Ẩn nội dung**: không hiện, không đếm đọc, và ẩn luôn số mới ở danh sách member.
- **Hoàn tác**: sau "Đánh dấu đã đọc hết" hiện thông báo "Đã đánh dấu đọc hết · Hoàn tác" 5 giây; Hoàn tác trả lại đúng trạng thái đã đọc trước khi bấm (dùng thông báo/toast sẵn có trong `shared/ui` nếu có; không có thì báo, đừng tự tạo component dùng chung mới).
- **Cuộn khi mở**: mở trang hoặc chọn member thì cuộn tới **prompt mới nhất** dù nó ở khối nào; "đang theo dõi" (S42) = prompt mới nhất trong khung nhìn. "Tải thêm" vẫn ở cuối nhóm ngày mới nhất; sự kiện tải thêm rơi vào đúng khối của nó.
- **Mở tất cả / Thu tất cả** áp cho cả ngày lẫn khối.
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
- [x] Hai phiên xen nhau (A prompt, B prompt, A lệnh, B lệnh, A lệnh): mỗi lệnh nằm dưới prompt của đúng phiên, không có lượt "không có prompt", mỗi phiên chỉ có một mục mở phiên.
- [x] Yêu cầu quyền ở phiên A, rồi prompt ở phiên B, rồi công cụ khớp chạy ở A: suy ra "cho phép" (trước đây "từ chối"). Không có gì tiếp theo ở A: "đang chờ".
- [x] `npm test` lỗi 3 lần ở phiên A xen với lệnh thành công ở phiên B: cờ lặp lệnh lỗi và "có thể đang kẹt" vẫn bật. Lỗi 2 lần ở A và 1 lần ở B: không bật.
- [x] Sửa file ở phiên A, chạy test thành công ở phiên B: **không** có cờ "sửa xong chưa chạy kiểm tra".
- [x] Lặp yêu cầu và nén tự động nhiều lần được xét trong từng phiên.
- [x] Zip: file member nhóm ngày → phiên → prompt; số phiên khớp web; lượt qua nửa đêm nằm ở ngày của prompt.
- [x] Báo cáo: ví dụ đã đánh dấu đi kèm đúng prompt cùng phiên.
- [x] Khối phiên (domain): đúng thứ tự, khoảng giờ, tóm tắt, `endedBy`, `overlapsWith`, "tiếp từ dd/mm" khi qua đêm. Số đếm ngày bằng tổng các khối.
### Phần 2 (sau thiết kế)
- [x] Khối phiên hiển thị và mở/thu đúng mặc định; `aria-*` và bàn phím như thiết kế.
- [x] Chip cờ, J/K, mở chi tiết, "N mới" tới sự kiện trong khối hoặc ngày đang thu thì cả hai tự mở. J/K theo thứ tự hiển thị.
- [x] Lượt mới, hoặc lượt cũ có sự kiện mới, nổi bật (không chỉ bằng màu). Nằm trong khung 2 giây thì hết; dưới 2 giây hoặc tab ẩn thì chưa hết.
- [x] Sự kiện tới trong lúc đang đếm 2 giây vẫn nổi bật sau khi lượt được đánh dấu đọc.
- [x] Lần đầu mở buổi trên một trình duyệt: không có gì nổi bật. Sự kiện tới sau thì có.
- [x] F5 giữ trạng thái đã đọc. `localStorage` lỗi hoặc bị chặn thì trang vẫn chạy (coi như lần đầu).
- [x] Danh sách member hiện đúng số prompt mới chưa đọc. Ngày/khối đang thu hiện "N mới". "Đánh dấu đã đọc hết" xoá hết nổi bật của member đó.
- [x] Chip "N sự kiện mới" đếm theo lượt chưa đọc.
- [x] Ẩn nội dung: không lộ nổi bật hay số mới trong dòng thời gian, không đếm đọc.
- [x] Buổi đã kết thúc thì key `localStorage` của buổi bị xoá.
- [x] `npm run typecheck`, `npm test` (gồm `arch:check`) pass.
- [ ] `npm run e2e` không có lỗi mới (mới chạy các spec training: chỉ còn lỗi cũ `training-export.spec.ts:99`; chưa chạy toàn bộ bộ e2e).

## Test
- Server domain: test cho từng cờ đổi sang theo phiên, gồm ca hai phiên xen nhau (dùng `flags/test-events.ts`, thêm tham số `claudeSessionId`). Test `inferPermissionDecision` cho ca xen phiên. Test `isStuck` theo phiên. Test `buildMemberFile` nhóm ngày → phiên → prompt và lượt qua nửa đêm.
- Web domain: `timeline.test.ts` thêm ca xen phiên (đúng prompt, không có lượt rỗng, một mục mở phiên mỗi phiên). Test hàm khối phiên (thứ tự, khoảng giờ, overlap, `endedBy` qua đêm). Test hàm thuần "chưa đọc" (mốc ban đầu, mốc theo lượt, số ở danh sách member). Test bộ đếm 2 giây với đồng hồ giả.
- Infrastructure: adapter `localStorage` không throw khi bị chặn hoặc dữ liệu hỏng.
- E2E (phần 2): mở rộng `e2e/training-multi-day.spec.ts` hoặc file mới `e2e/training-sessions.spec.ts`. Gửi JSON hook giả của hai phiên xen nhau, kiểm khối phiên, nổi bật biến mất sau khoảng 2 giây trong khung, số ở danh sách member, F5 giữ trạng thái. Chụp ảnh vào `docs/design/S43-assets/`.

## Module bị chạm
`src/server/domain/training/{flags,is-stuck.ts,export.ts,report.ts}`, `src/server/application/{ports/training-event-repository.ts,use-cases/training/admin.ts}`, `src/server/infrastructure/db/drizzle-training-event-repository.ts` (nếu đổi port), `src/web/features/training-admin/{domain,application,infrastructure,ui}`, `docs/architecture.md` §11.8–11.9, test tương ứng, `e2e/`.

## Thứ tự làm gợi ý
Phần 1 làm và review được trước, có thể thành PR riêng. Phần 2 chỉ bắt đầu khi thiết kế đã được PO duyệt và story có mục "Thiết kế".

## Thiết kế (PO duyệt 2026-11-25)
- Canvas: https://claude.ai/artifact/VweyUbGHM2TvdB3hc1GpSL (trang "S43 · Khối phiên & đánh dấu mới").
- Bản chép trong repo, [`docs/design/S43-design/`](../design/S43-design/):
  - `Spec.dc.html` là **spec cho dev**: số đo, token, tương tác, component.
  - `Screen.dc.html` là màn hình dùng chung cho các frame, `variant`: `default`, `all`, `single`, `collapsedNew`, `chip`, `midnight`, `flag`, `hidden`.
  - `PromptCard.dc.html` là thẻ prompt với các trạng thái mới (`stage`: `fresh` / `fading` / `read`; `ev` cho sự kiện mới trong prompt cũ).
  - `Cards.dc.html` vẽ các tổ hợp tín hiệu (mới + lỗi / cờ / ví dụ / focus).
  - `Members.dc.html` vẽ danh sách member và hàng học viên.

Các file là HTML của công cụ thiết kế, không chạy trong app. Token (`--ink-*`, `--brand-*`, `--wrong-600`, `--sun-*`, `--focus-ring`, `--dur-*`, …) lấy token tương ứng trong `src/web`; thiếu thì báo, không tự đặt giá trị mới.

### Điểm chính (tóm tắt Spec; chi tiết xem file)
- **`SessionBlockHeader`** thay `SessionMarker`. Props `{ index, range, counts, end: 'clear' | 'exit' | 'open' | 'next', continuedFrom?, parallelWith?: number[], newCount?, expanded, onToggle, variant: 'default' | 'light' }`.
  - Không nền, không viền, nằm trên đường ray của ngày, hàng tối thiểu 32px. Chevron 14 `ink-600`. Tiêu đề 600 13px `ink-900`; tóm tắt 400 13px `ink-600`, số tabular, số lỗi 600 `wrong-600`.
  - Nút gồm chevron + tiêu đề + tóm tắt (`aria-expanded`, `aria-controls`). Các nhãn bên phải nằm ngoài nút.
  - Nhãn kết thúc: `/clear` mono, nền `ink-100`, bo 4. "thoát", "tiếp từ dd/mm", "tiếp sang dd/mm": nền `ink-100`, bo tròn. "chưa kết thúc": không nền, viền đứt `ink-400`, không chấm nhấp nháy, không màu "đang chạy".
  - "Song song với phiên M" là nút viền `ink-300`, bấm thì mở và cuộn tới khối M. Nhiều phiên thì ghi "phiên 7, 9".
  - Chấm mốc 12px: mở = vòng rỗng viền `ink-500`, thu = chấm đặc `ink-300`.
  - Hover nền `ink-100` bo 8; focus `focus-ring`. Cột hẹp: nhãn xuống dòng, vạch đứt tối thiểu 24px.
  - Ngày chỉ có một phiên: biến thể `light`, không phải nút.
  - Khối cuối ngày của phiên kéo qua 0 giờ ghi "tiếp sang dd/mm" ở chỗ nhãn kết thúc (`end: 'next'`).
- **Khoảng cách**:
  - Prompt không thụt thêm (vẫn 36px như S42).
  - Khối đầu ngày đệm trên 2px. Sau một khối đang mở: 16px giữa hai khối. Hai khối thu liền nhau: 4px (36px mỗi hàng).
  - Tiêu đề khối → prompt đầu: 4px. Prompt ↔ prompt: 8px.
- **Không dính**: tiêu đề khối không dính. Khi tiêu đề khối đã cuộn qua, tiêu đề ngày đang dính ghi thêm chữ phụ "· Phiên N" bên phải, không tăng chiều cao.
- **Mở/thu khối**: như ngày ở S42. Không làm hiệu ứng chiều cao; chevron xoay trong `dur-fast`; nội dung hiện bằng `pq-fade`. Tab: tiêu đề khối → nút song song → prompt. Prompt mới đến trong khối đang thu ở phía trên thì chỉ cập nhật "N mới", không tự mở.
- **`NewBadge`** `{ label?: 'Mới' | 'Lệnh mới', count?, size: 'sm' | 'md', fading? }`.
  - Nền `brand-600`, chữ trắng 700 11px, cao 18px (20px ở danh sách member), bo tròn, luôn có chữ. `count` thì hiện "N mới"; từ 100 trở lên là "99+ mới".
  - Chữ cho trình đọc màn hình: "Mới — prompt mới", "Lệnh mới — sự kiện mới trong prompt đã đọc", "N prompt có mục mới".
- **Thẻ prompt mới**: "Mới" đứng đầu hàng, viền thẻ `brand-500` 1px.
  - Hết mới (sau 2 giây): nhãn opacity 1 → 0 và scale 1 → .92, viền về `ink-200`, trong `dur-slow` / `ease-standard`. Giảm chuyển động thì đổi ngay. Chỗ của nhãn thu lại trên cùng hàng, không đổi chiều cao.
- **Prompt cũ có sự kiện mới**: viền thẻ không đổi. Tóm tắt thêm "· N mới" (`brand-700`). Dưới nội dung có dải `PromptEventStrip` `{ kind: 'command' | 'permission', text, result, at, fading? }`, nền `brand-050`, viền `brand-200`, nhãn "Lệnh mới".
  - Hết mới thì dải về nền trắng viền `ink-200`. Dải **chỉ được bỏ khi thẻ đã ra khỏi khung nhìn**, có giữ neo cuộn.
  - Nhiều sự kiện mới trong một prompt: hiện tối đa 3 dải, rồi một dòng "và N sự kiện mới khác". Thiết kế không vẽ trường hợp này; đây là quyết định của main session.
- **Tổ hợp tín hiệu**: focus = nền `sun-100` (vẫn giữ viền cobalt khi đang mới); cờ = chip viền xám; lỗi = chỉ con số màu đỏ; ví dụ = nhãn mực đậm. Dùng kiểu "focus" và "ví dụ" sẵn có của app.
- **`DayGroupHeader`** thêm `newCount`. "N mới" đặt ngay sau tóm tắt, trước chip cờ, chỉ khi ngày đang thu. Khối cũng vậy.
- **Danh sách member** (`Members.dc.html`):
  - "N mới" nằm sát mép phải hàng, cùng kiểu `NewBadge` md.
  - Trạng thái người học là dòng phụ `ink-600` dưới tên.
  - Không dùng đỏ hay chấm thông báo; không sắp xếp theo số mới.
  - Trình đọc màn hình đọc: "Minh, có thể đang kẹt, 5 prompt mới".
- **Hàng học viên**: thứ tự từ trái "Đánh dấu đã đọc hết" (`Button` ghost sm, icon `list-checks`) · "Mở/Thu tất cả" · "Ẩn nội dung". Không còn mục mới thì nút đầu chuyển sang **vô hiệu**, không ẩn. Cột hẹp: các nút xuống dòng riêng.
- **Chip nổi**: "↑ N prompt có mục mới" ở mép phía có prompt đó, chỉ hiện khi có prompt có mục mới nằm ngoài khung. Bấm thì mở ngày/khối, cuộn tới prompt gần nhất, tô focus rồi nhạt dần; đồng hồ 2 giây vẫn áp dụng.
- **Đồng hồ 2 giây**: chạy khi ≥ 50% thẻ (hoặc ≥ 200px nếu thẻ cao hơn khung) nằm trong khung, tab hiện, cửa sổ đang được chọn, không ẩn nội dung. Ra khỏi khung thì đặt lại về 0. Không hiện đồng hồ trên giao diện.

### Quyết định của PO về các điểm designer nêu (2026-11-25)
- Khối "chưa kết thúc" **luôn mở mặc định** như spec, không thêm ngưỡng 30 phút. PO chấp nhận rằng phiên không gửi được tín hiệu kết thúc sẽ luôn mở.
- Đếm đọc cần **cửa sổ đang được chọn** (`document.hasFocus()`).
- Chữ chip: "N prompt có mục mới".
- Mở trang thì cuộn tới **prompt mới nhất** dù ở khối nào.
- Ẩn nội dung ẩn luôn số mới ở danh sách member.
- Có thông báo "Hoàn tác" 5 giây sau "Đánh dấu đã đọc hết".
- Số ở danh sách member **chỉ đếm prompt mới**, khác cách designer đề xuất. Dữ liệu mẫu "Lan 5 mới" trong frame vì vậy không áp dụng.
- "Mở tất cả / Thu tất cả" áp cho cả ngày lẫn khối (theo frame 2).

### Acceptance criteria (thiết kế)
- [ ] Tiêu đề khối, nhãn kết thúc, nút song song, chấm mốc, khoảng cách khớp Spec (token tương ứng trong app). (Đã làm theo Spec, nhưng số đo px chưa có assertion tự động; cần reviewer đối chiếu ảnh.)
- [x] Bấm "Song song với phiên M" thì mở và cuộn tới khối M.
- [x] Tiêu đề ngày đang dính ghi thêm "· Phiên N" khi tiêu đề khối đã cuộn qua.
- [x] Thẻ prompt mới / prompt cũ có lệnh mới / đang mờ / đã đọc khớp `PromptCard.dc.html`. Dải "Lệnh mới" chỉ bị bỏ khi thẻ ngoài khung nhìn, nội dung đang đọc không nhảy.
- [x] Nút "Đánh dấu đã đọc hết" vô hiệu khi không còn mục mới. "Hoàn tác" trong 5 giây trả lại trạng thái cũ.
- [x] Chip "N prompt có mục mới" ở mép phía có prompt đó.
- [x] Mở trang hoặc chọn member: prompt mới nhất trong khung nhìn, kể cả khi nó nằm ở khối phía trên.
- [x] Cửa sổ mất focus thì không đếm đọc.
- [x] Ảnh `docs/design/S43-assets/` theo các frame: `default` (1440 và 800px), `all`, `single`, `collapsedNew`, `chip`, `midnight`, `flag`, `hidden`, thẻ prompt (mới, có lệnh mới, đã đọc), danh sách member.

## Đã làm (ghi chú)
- **Server**: `perSession()` trong `flags/flag-event.ts` bọc `repeatedFailure`, `repeatedRequest`, `autoCompactRepeated`, `fastApprovals`; `inferPermissionDecision` đọc từng phiên. `longWithoutVerify` giữ nguyên cả member. `editedNotVerified`: cắt lượt theo phiên nhưng "đã kiểm tra" xét cả member (một lệnh kiểm tra ở phiên khác trong lúc lượt đang chạy cũng tính). `isStuck(tools)` theo phiên; **bỏ** port `recentTools`, kẹt tính từ `listForFlags` trong `flagsOf` (dùng chung cache theo `lastEventId`); ghi ở architecture §11.8/§11.9. `buildMemberFile` nhóm ngày -> phiên -> prompt (tiêu đề prompt hạ một cấp, ngày theo prompt, câu giải thích ở `00-tong-quan.md`). `report.ts` đã lấy ví dụ theo chính sự kiện đã đánh dấu, không cần sửa.
- **Web domain**: `buildTimeline` giữ lượt hiện tại theo phiên (bỏ item `session`), `session-blocks.ts`, `day-groups.ts` (khối, `placesByEvent`, `stepEvent` theo thứ tự hiển thị), `unread.ts`, `read-dwell.ts`, `isCardReadable`. `endedBy` lấy trên cả buổi; `continuedFrom`/`continuesTo` là ngày (ms) của khối liền trước/sau; hiển thị `next` khi có `continuesTo`. Khối mặc định mở khi `endedBy === null` hoặc có mục chưa đọc.
- **Đã đọc**: record có thêm `readPromptCount` (số prompt sau mốc đã đọc) để số ở danh sách member tính được mà không cần tải sự kiện. Sự kiện `notice` không làm lượt "mới". Hoàn tác và dọn key ở controller; port `TrainingReadStore`, adapter `LocalStorageTrainingReadStore`, context `TrainingReadStoreContext`.
- **UI**: `SessionBlockHeader` (thay `SessionMarker`), `NewBadge`, `PromptEventStrip`, `UndoToast` (không có toast dùng chung nên đặt trong feature), `DayGroupHeader` thêm `newCount` và "· Phiên N". Mô tả truy cập của số ở danh sách member dùng `aria-describedby` để tên nút vẫn là tên học viên.
- **Sau review vòng 1**: zip theo khoảng ngày chọn lượt theo ngày của prompt (`export-selection.ts`, reader `listEventSkeleton` + `listForExportByIds`, thay `listForExport`), số phiên theo cả buổi, số sự kiện ở bước đếm của hộp thoại xuất cũng theo lượt (kích thước vẫn ước theo ngày). Danh sách member: trạng thái học viên là dòng phụ dưới tên, "N mới" ở mép phải cả bảng rộng. Hàng học viên theo thứ tự "Đánh dấu đã đọc hết · Mở/Thu tất cả · Ẩn nội dung" (chưa chọn member thì nút Ẩn nội dung ở header trang; phím H như cũ). "Đánh dấu đã đọc hết" chốt mốc theo số prompt trong sự kiện đã tải. "Song song với phiên 7, 9": mỗi số là một nút.
- **Ngoài phạm vi (đã chấp nhận)**: nhãn "Ví dụ" trên thẻ prompt, app không có nhãn này, giữ kiểu đánh dấu sẵn có.
- **E2E**: `e2e/training-sessions.spec.ts` (3 test), sửa `training-multi-day.spec.ts` và `training-admin.spec.ts` cho khối phiên và chip mới. Ảnh ở `docs/design/S43-assets/`. 
- **Sau review vòng 2**: bảng member rộng (chưa chọn member) vừa khít khung, không cuộn ngang ở 1280 và 1440: "N mới" nằm cuối ô "Lần cuối" (mép phải hàng), lề ô 6px, cột tên tối thiểu 132px, dòng trạng thái không xuống dòng. E2E kiểm `scrollWidth <= clientWidth` và badge nằm trọn trong khung; ảnh `members-wide.png`. Zip theo khoảng ngày: nhãn cuối khối (`/clear`, `thoát`, `tiếp từ`, `tiếp sang`) tính trên cả buổi qua `sessionContext(skeleton)`, có test hai chiều (chỉ ngày đầu, chỉ ngày sau). Architecture §11.10 mô tả `export-selection.ts`, cặp reader mới và việc `eventCount` đếm theo lượt còn `approxBytes` ước theo ngày.
- **Lưu ý e2e**: `training-sessions` test 1 và `training-multi-day` (kiểm vị trí cuộn sau khi ẩn/hiện nội dung) từng fail một lần khi chạy cả loạt training liền nhau, pass khi chạy lại (multi-day 6/6 lần chạy riêng); chưa tìm ra nguyên nhân, nghi do thời gian (đồng hồ 2 giây đổi bố cục giữa lúc ẩn và hiện).
- **Sửa lần cuối (bảng member rộng)**: chip cờ ở bảng rộng được phép xuống dòng (`FlagChip wrap`, cột "Cờ gợi ý" rộng 130-160px), cột số lề 4px, và ô "Lần cuối" (chứa "N mới") dính mép phải (`position: sticky; right: 0`). E2E có thêm 3 member (cờ "Sửa xong chưa chạy kiểm tra" + "Đụng vào test", "Lệnh nguy hiểm", "có thể đang kẹt") và kiểm ở 1280/1440: không cuộn ngang, mọi `[data-member-new]` nằm trọn trong khung, dòng "có thể đang kẹt" một dòng. Chip dài xuống nhiều dòng nên hơi chật (từng từ một dòng); chưa tối ưu thêm.
