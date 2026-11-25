# S44: Training: xuất ví dụ prompt giấu tên để dạy khoá sau

**Phụ thuộc:** S40, S43 · **Trạng thái:** ⏳ chưa làm

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
  - Trên mỗi dòng prompt (danh sách chính và popup chi tiết): nút "Ví dụ dạy lớp sau". Đã là ví dụ thì nút hiện trạng thái (biểu tượng + chữ, không chỉ màu). Member chưa đồng ý: nút khoá, kèm lý do "Bạn này không đồng ý cho dùng làm ví dụ".
  - Hộp thoại sửa ví dụ: nhãn (bắt buộc), chủ đề, nhận xét (bắt buộc), phiên bản tốt hơn (tuỳ chọn), nút bỏ ví dụ.
  - Nút "Xuất ví dụ dạy lớp sau" ở trang buổi, cạnh hai nút xuất hiện có. Màn rà: danh sách ví dụ, mỗi ví dụ có ô sửa prompt và ô sửa bối cảnh (đổ sẵn bản đã che), nút "Về bản gốc", ô tick "Tôi đã rà…", nút tải. Trạng thái: chưa có ví dụ nào; đang tải; lỗi lưu.
  - Ẩn nội dung (phím H) thì màn rà không hiện nội dung, như hộp thoại báo cáo S40.
- **Web member (màn đồng ý)**: ô tick tuỳ chọn theo §7.39a, mặc định không tick, kèm các câu giải thích. Câu chữ thống nhất với `consent-copy.ts` hiện có.
- **UI**: dùng lại `ConfirmDialog`, các ô nhập và nút trong `src/web/shared/ui`, theo kiểu hộp thoại báo cáo S40 và xuất dữ liệu S41. Chưa qua designer (PO có thể yêu cầu sau khi xem ảnh chụp).

## Ngoài phạm vi
- Thư viện ví dụ lâu dài trong app, trang cho khoá sau xem (§7.39h).
- Member đổi lựa chọn đồng ý sau khi đã tham gia; báo cho member prompt nào được chọn.
- Gắn nhãn cho sự kiện không phải prompt.

## Acceptance criteria
1. Màn đồng ý có ô tick riêng, **mặc định không tick**; không tick vẫn tham gia được. Member đã có từ trước (migration) có `teaching_consent = true` (PO quyết: mentor đã xác nhận ngoài app, §7.39a). Member mới vào sau migration mà không gửi `teachingConsent` → false.
2. Chỉ prompt của member có `teaching_consent = true` mới tạo được ví dụ; khác → 409 (`code: no_teaching_consent`). Sự kiện không phải prompt → 400. Sự kiện không thuộc buổi → 404. Buổi `ended` → 409.
3. Nhãn và nhận xét bắt buộc (nhận xét ≤ 2000 ký tự; các ô khác ≤ 4000). Lưu lại không đổi gì nếu gửi cùng nội dung (idempotent theo `event_id`).
4. Bối cảnh mặc định của một lượt: các sự kiện `tool` cùng phiên Claude Code từ sau prompt tới prompt kế của phiên đó (cùng cách gom lượt S43), mỗi lệnh một dòng `✓`/`✗` + tên công cụ + đích rút gọn; **không** có output, lỗi hay nội dung sửa file. Cả prompt và bối cảnh mặc định đã qua `maskSecrets`.
5. File xuất **không** chứa: tên hiển thị của bất kỳ member nào trong buổi, ngày giờ của sự kiện, số phiên, output, nội dung sửa file (có test quét nội dung file với dữ liệu mẫu có tên, ngày, output).
6. File xếp theo chủ đề → nhãn; trong cùng nhóm, thứ tự là xáo ổn định theo `event_id` (không theo member, không theo thời gian). Mỗi ví dụ có: nhãn, prompt (bản sửa nếu có, không thì bản gốc đã che), bối cảnh (tương tự), nhận xét, phiên bản tốt hơn nếu có. Đầu file có tên buổi và đoạn giới thiệu theo §7.39d. Toàn bộ văn bản qua `maskSecrets` ở bước cuối.
7. Tải file cần `confirmed=1`; thiếu → 400 (`code: review_not_confirmed`). Không có ví dụ nào → 404 (`code: no_examples`), web báo và không tải.
8. Member đã dừng gửi (chưa duyệt xoá) vẫn có ví dụ trong file. Duyệt xoá member → ví dụ của họ mất theo (cascade).
9. Nhãn, nhận xét, ví dụ **không** xuất hiện trong: `report.md` (S40), zip (S41), `TrainingMemberRow`, cờ, `flagCounts`, mọi route member, màn hình chiếu.
10. Kết thúc xoá mọi ví dụ. Xuất ví dụ không ghi `report_exported_at`.

## Test
- Domain: dựng bối cảnh của lượt (phiên song song, lượt không có lệnh), dựng Markdown (thứ tự nhóm, xáo ổn định, bản sửa thắng bản gốc, che bí mật ở bước cuối), quét không có tên/ngày/output.
- Tích hợp HTTP: join có/không `teachingConsent`; tạo/sửa/xoá ví dụ (409/400/404 như AC 2); tải file (`confirmed`, rỗng, member dừng gửi, purge, ended); ví dụ không lọt vào report/zip/route member.
- E2E: member tick đồng ý riêng; mentor tạo ví dụ, mở màn rà, sửa prompt, tick, tải file. Một member không tick → nút khoá. Ảnh chụp vào `docs/design/S44-assets/` (màn đồng ý, hộp thoại ví dụ, màn rà).

## Module bị chạm
`infrastructure/db/schema.ts` + migration, `domain/training/` (file mới cho ví dụ dạy), `application/ports/` + `use-cases/training/`, `interface/http/training-routes.ts`, `src/shared/api/training.ts`, `features/training-admin` (dòng prompt, hộp thoại, màn rà, controller), `features/training-member` (màn đồng ý, `consent-copy.ts`).
