# S44: Training: xuất ví dụ prompt giấu tên để dạy khoá sau

**Phụ thuộc:** S40, S43 · **Trạng thái:** 🔄 đang làm

## Bối cảnh
Mentor muốn dạy khoá training sau bằng ví dụ thật: chọn prompt của member, gắn nhãn tốt / chưa tốt, viết nhận xét, rồi xuất thành tài liệu **không có tên**. Member phải đồng ý riêng (mặc định không). App không giữ tài liệu sau Kết thúc. Business: [PRODUCT.md §7.39](../PRODUCT.md), cùng §7.34a, b và §7.35e, j.

## Phạm vi
Contract: `architecture.md` §11.11.

- **Server**
  - `training_members.teaching_consent` (boolean; dòng cũ được đặt true trong migration, dòng mới mặc định false). `POST /api/trainings/:id/join` nhận thêm `teachingConsent?: boolean` (bỏ trống = false). Không có route đổi lựa chọn.
  - Bảng `training_teaching_examples` (khoá là `event_id` của một sự kiện **prompt**, cascade): `label` (`good` | `needs_work`), `topic` (`verify` | `delegation` | `stuck` | `risk` | `other`, mặc định `other`), `comment`, `better_prompt?`, `edited_prompt?`, `edited_context?`, `updated_at`.
  - Route mentor: tạo/sửa, xoá, liệt kê ví dụ (kèm nội dung prompt và bối cảnh mặc định để rà), tải file Markdown.
  - Domain thuần: dựng bối cảnh mặc định của một lượt; dựng file Markdown; xáo thứ tự ổn định không theo member.
- **Web mentor** (`features/training-admin`)
  - Trên mỗi dòng prompt (danh sách chính và popup chi tiết): nút "Ví dụ". Đã là ví dụ thì nút hiện trạng thái (biểu tượng + chữ, không chỉ màu). Member chưa đồng ý: nút khoá, kèm lý do "Bạn này không đồng ý cho dùng làm ví dụ".
  - Hộp thoại sửa ví dụ: nhãn (bắt buộc), chủ đề, nhận xét (bắt buộc), phiên bản tốt hơn (tuỳ chọn), nút bỏ ví dụ.
  - Nút "Xuất ví dụ" ở trang buổi, cạnh hai nút xuất hiện có. Màn rà: danh sách ví dụ, mỗi ví dụ có ô sửa prompt và ô sửa bối cảnh (đổ sẵn bản đã che), nút "Về bản gốc", ô tick "Tôi đã rà…", nút tải. Trạng thái: chưa có ví dụ nào; đang tải; lỗi lưu.
  - Ẩn nội dung (phím H) thì màn rà không hiện nội dung, như hộp thoại báo cáo S40.
- **Web member (màn đồng ý)**: ô tick tuỳ chọn theo §7.39a, mặc định không tick, kèm các câu giải thích. Câu chữ thống nhất với `consent-copy.ts` hiện có.
- **UI**: dùng lại `ConfirmDialog`, các ô nhập và nút trong `src/web/shared/ui`, theo kiểu hộp thoại báo cáo S40 và xuất dữ liệu S41. Chưa qua designer (PO có thể yêu cầu sau khi xem ảnh chụp).

## Ngoài phạm vi
- Thư viện ví dụ lâu dài trong app, trang cho khoá sau xem (§7.39h).
- Member đổi lựa chọn đồng ý sau khi đã tham gia; báo cho member prompt nào được chọn.
- Gắn nhãn cho sự kiện không phải prompt.

## Acceptance criteria
1. [x] Màn đồng ý có ô tick riêng, **mặc định không tick**; không tick vẫn tham gia được. Member đã có từ trước (migration) có `teaching_consent = true` (PO quyết: mentor đã xác nhận ngoài app, §7.39a). Member mới vào sau migration mà không gửi `teachingConsent` → false.
2. [x] Chỉ prompt của member có `teaching_consent = true` mới tạo được ví dụ; khác → 409 (`code: no_teaching_consent`). Sự kiện không phải prompt → 400. Sự kiện không thuộc buổi → 404. Buổi `ended` → 409.
3. [x] Nhãn và nhận xét bắt buộc (nhận xét ≤ 2000 ký tự; các ô khác ≤ 4000). Lưu lại không đổi gì nếu gửi cùng nội dung (idempotent theo `event_id`).
4. [x] Bối cảnh mặc định của một lượt: các sự kiện `tool` cùng phiên Claude Code từ sau prompt tới prompt kế của phiên đó (cùng cách gom lượt S43), mỗi lệnh một dòng `✓`/`✗` + tên công cụ + đích rút gọn; **không** có output, lỗi hay nội dung sửa file. Cả prompt và bối cảnh mặc định đã qua `maskSecrets`.
5. [x] File xuất **không** chứa tên hiển thị của member lấy từ dữ liệu của app (metadata), ngày giờ của sự kiện, số phiên, output, nội dung sửa file (có test quét file với dữ liệu mẫu có tên, ngày, output). Tên người gõ trong nội dung tự do (prompt, bối cảnh, nhận xét, phiên bản tốt hơn) thì app không tự xoá: màn rà cảnh báo từng ví dụ có chứa tên một member của buổi (không phân biệt hoa thường, dấu), nói rõ ô nào, để mentor sửa ngay tại đó (PRODUCT.md §7.39g).
6. [x] File xếp theo chủ đề → nhãn; trong cùng nhóm, thứ tự là xáo ổn định theo `event_id` (không theo member, không theo thời gian). Mỗi ví dụ có: nhãn, prompt (bản sửa nếu có, không thì bản gốc đã che), bối cảnh (tương tự), nhận xét, phiên bản tốt hơn nếu có. Đầu file có tên buổi và đoạn giới thiệu theo §7.39d. Toàn bộ văn bản qua `maskSecrets` ở bước cuối.
7. [x] Tải file cần `confirmed=1`; thiếu → 400 (`code: review_not_confirmed`). Không có ví dụ nào → 404 (`code: no_examples`), web báo và không tải.
8. [x] Member đã dừng gửi (chưa duyệt xoá) vẫn có ví dụ trong file. Duyệt xoá member → ví dụ của họ mất theo (cascade).
9. [x] Nhãn, nhận xét, ví dụ **không** xuất hiện trong: `report.md` (S40), zip (S41), `TrainingMemberRow`, cờ, `flagCounts`, mọi route member, màn hình chiếu.
10. [x] Kết thúc xoá mọi ví dụ. Xuất ví dụ không ghi `report_exported_at`.
11. [x] Tên (PO chốt): nút trên prompt là "Ví dụ" (đã là ví dụ: "Ví dụ: Tốt" / "Ví dụ: Chưa tốt"), nút đầu trang "Xuất ví dụ"; tên file, tiêu đề hộp thoại và câu chữ trên UI không còn "lớp sau" / "dạy lớp sau". Dấu đánh dấu của S40 đổi tooltip/aria-label thành "Đánh dấu cho báo cáo" / "Bỏ đánh dấu cho báo cáo".
12. [x] Bấm Kết thúc khi còn ví dụ chưa xuất (chưa tải lần nào, hoặc có ví dụ tạo/sửa sau lần tải gần nhất) thì hộp thoại Kết thúc nhắc "Còn N ví dụ chưa xuất" với nút mở màn xuất ví dụ; vẫn cho Kết thúc. Gộp với lời nhắc báo cáo S40 trong cùng hộp thoại.


### Sau khi designer rà (PO duyệt 2026-11-25, PRODUCT §7.39j)
Thiết kế: https://claude.ai/artifact/WFH84qNFHt7FKamvweVFJs; bản sao trong repo: [S44-design/](../design/S44-design/) (`review-screen.dc.html` = màn rà, `timeline-export-menu.dc.html` = dòng thời gian + menu Xuất, `consent-phone.dc.html` = màn đồng ý điện thoại; HTML tĩnh, đọc style inline). Mockup dùng Google Fonts: khi code dùng font đã bundle (offline). Câu chữ theo thiết kế, trừ chỗ ghi khác dưới đây.

13. [ ] **Rà từng ví dụ**: `training_teaching_examples.reviewed_at?`. Route `PUT|DELETE .../teaching-example/reviewed` (idempotent, 409 khi `ended`). Mọi lần lưu làm đổi nội dung ví dụ (nhãn, chủ đề, nhận xét, bản tốt hơn, bản sửa prompt/bối cảnh) thì xoá `reviewed_at`. `TeachingExampleRow.reviewed`. Tải file: thay `confirmed=1` bằng điều kiện **mọi ví dụ đã rà**, còn ví dụ chưa rà → 400 `examples_not_reviewed` (kèm số). Bỏ ô tick chung.
14. [ ] **Màn rà theo thiết kế `Main`**: cột trái nhóm theo chủ đề, mỗi ví dụ có trạng thái (chưa rà / đã rà / N chỗ nghi là tên / N trường đã sửa); đầu màn "Đã rà N/M" + thanh tiến độ + dãy gợi ý "Tìm và sửa"; nút "Đã rà ví dụ này, sang tiếp" (sang ví dụ chưa rà kế tiếp); "Trước"; nút tải ghi "Tải file .md · còn N chưa rà" và khoá khi N > 0. Cảnh báo tên (từ `nameHits`): tô nổi chữ trong ô, nút "Thay bằng “[bạn]”" (thay mọi chỗ của tên đó trong ví dụ) và "Không phải tên" (bỏ cảnh báo tên đó cho ví dụ đó, chỉ trong trình duyệt). Nhãn "Đã sửa" trên ô đã sửa; nút "Khôi phục bản app đã che". Lỗi lưu: chữ đỏ + "Thử lại". Ẩn nội dung (H) vẫn như cũ.
15. [ ] **Che đường dẫn thư mục người dùng** (domain thuần, có test): trong prompt và bối cảnh mặc định của ví dụ, `/home/<tên>`, `/Users/<tên>`, `C:\Users\<tên>`, `C:/Users/<tên>` (mọi ổ đĩa, không phân biệt hoa thường của `Users`) → `~`. Chạy lại ở bước cuối khi dựng file (cùng chỗ `maskSecrets`). Không áp cho `report.md` và zip. Trên màn rà, phần đã tự che hiện như ô xám (title "App đã tự che") như thiết kế.
16. [ ] **Dòng thời gian theo thiết kế `Timeline`**: nút trên prompt "Làm ví dụ" (chưa chọn), "Ví dụ: Tốt" (xanh), "Ví dụ: Chưa tốt" (xám trung tính); vạch ngăn; dấu S40 có chữ "Báo cáo" (aria-label vẫn "Đánh dấu cho báo cáo" / "Bỏ đánh dấu cho báo cáo"). Member không đồng ý: **không render nút** trên prompt; chip khoá "Không dùng làm ví dụ" ở đầu khung member. AC 11 được thay bằng AC này ở chỗ khác nhau.
17. [ ] **Menu "Xuất"** thay 3 nút: mục "Báo cáo buổi" (Có tên), "Dữ liệu thô để phân tích (.zip)" (Có tên + output), "Rà & xuất ví dụ…" (Không tên), mỗi mục một dòng mô tả. Bàn phím: mở bằng Enter/Space, ↑/↓, Esc đóng và trả focus. Lời nhắc khi Kết thúc vẫn mở đúng màn tương ứng.
18. [ ] **Màn đồng ý theo thiết kế `Consent`**: khung tuỳ chọn riêng (nhãn "Tuỳ chọn") đặt trước phần "Bắt buộc để tham gia"; tiêu đề khung **"Dùng prompt của bạn làm ví dụ"** (không nói "lớp sau"/"khoá sau"); thêm câu "File không có tên bạn, nhưng người cùng lớp vẫn có thể đoán ra từ nội dung."; dòng tóm tắt "Bạn đang chọn: … · Làm ví dụ: Có/Không". Giữ các ý bắt buộc của AC 1. Kiểm ở 390px không tràn ngang, ô tick ≥ 44px.

## Test
- Domain: dựng bối cảnh của lượt (phiên song song, lượt không có lệnh), dựng Markdown (thứ tự nhóm, xáo ổn định, bản sửa thắng bản gốc, che bí mật ở bước cuối), quét không có tên/ngày/output.
- Tích hợp HTTP: join có/không `teachingConsent`; tạo/sửa/xoá ví dụ (409/400/404 như AC 2); tải file (`confirmed`, rỗng, member dừng gửi, purge, ended); ví dụ không lọt vào report/zip/route member.
- E2E: member tick đồng ý riêng; mentor tạo ví dụ, mở màn rà, sửa prompt, tick, tải file. Một member không tick → nút khoá. Ảnh chụp vào `docs/design/S44-assets/` (màn đồng ý, hộp thoại ví dụ, màn rà).

## Module bị chạm
`infrastructure/db/schema.ts` + migration, `domain/training/` (file mới cho ví dụ dạy), `application/ports/` + `use-cases/training/`, `interface/http/training-routes.ts`, `src/shared/api/training.ts`, `features/training-admin` (dòng prompt, hộp thoại, màn rà, controller), `features/training-member` (màn đồng ý, `consent-copy.ts`).

## Ghi chú khi làm
- Migration `0018_skinny_plazm.sql`: sau khi `db:generate`, thêm tay `UPDATE training_members SET teaching_consent = 1` (chạy sau `ADD COLUMN`, nên chỉ dòng cũ bị đổi; dòng mới mặc định 0). Có test trong `schema.test.ts` (dựng DB tới migration 0017, thêm member, chạy 0018, thêm member mới).
- Lệch nhẹ so với §11.11, không đổi hợp đồng HTTP: thao tác ví dụ nằm trên `TrainingEventReader/Repository` (không có repository riêng), nên `TrainingUnitContext` không đổi. `turnOf()` thêm vào `export-selection.ts` (cùng cách gom lượt S43) và `buildTurnContext` dùng nó; `buildTurnContext` đọc `listForFlags` (text có giới hạn, không output).
- Lỗi mới: `not_a_prompt` (400), `no_teaching_consent` (409), `review_not_confirmed` (400), `no_examples` (404).
- PUT trả cả `TeachingExampleRow` (có `memberName`, `defaultPrompt`, `defaultContext`). Gửi cùng nội dung thì không ghi lại, `updatedAt` giữ nguyên. `editedPrompt`/`editedContext` rỗng `''` là bản sửa hợp lệ (không có lệnh); `null`/vắng là chưa sửa.
- Màn rà: bản sửa lưu khi rời ô nhập, "Về bản gốc" lưu luôn; sửa gì cũng bỏ tick "đã rà"; khi Ẩn nội dung (H) màn rà không hiện nội dung và không cho tải.
- Nút khoá hiển thị chữ ngắn "Không dùng làm ví dụ" (đa số member mới sẽ khoá, nên không lặp cả câu); lý do đầy đủ nằm ở tooltip và chữ cho trình đọc màn hình. Cần PO/designer xem lại.
- Ảnh chụp: `docs/design/S44-assets/` (1-man-dong-y, 2-hop-thoai-vi-du, 3-nut-khoa, 4-man-ra-soat).
- Sau review: màn rà sửa được cả nhận xét và phiên bản tốt hơn tại chỗ (lưu khi rời ô, sửa gì cũng bỏ tick "đã rà"); cảnh báo tên dùng `nameHits` (domain web, có test); lời nhắc ở màn rà nói rõ phải kiểm tra đường dẫn và tên người dùng máy trong các lệnh; `TimelineCache` phía server cache Promise.
- AC 11/12 (PO 2026-11-25): migration `0019_flimsy_jackpot.sql` thêm `trainings.examples_exported_at`; `unexportedExampleCount` đếm ví dụ có `updated_at` sau lần tải gần nhất (cùng mili giây coi như đã xuất). Test migration 0018 giờ cắt journal ở trước 0018 (idx < 18). Ảnh `6-nhac-khi-ket-thuc.png` mới.
