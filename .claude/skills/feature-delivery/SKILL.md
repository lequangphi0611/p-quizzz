---
name: feature-delivery
description: Quy trình giao một tính năng p-quizzz từ yêu cầu tới PR - phân tích yêu cầu (requirement-clarify) → PO duyệt → cập nhật PRODUCT.md + viết story → agent coder implement → agent reviewer review (chạy test + thao tác thật bằng Playwright) → commit, push, tạo PR. Trigger: "làm tính năng ... tới PR", "chạy workflow", "giao cho coder", "implement và review", sau khi PO đã chốt phương án từ requirement-clarify.
---

# Giao tính năng: yêu cầu → PR

Main session là **người điều phối**: giữ context với PO, viết spec, gọi agent, commit/push/tạo PR. Code do agent `coder` (Sonnet) viết; review do agent `reviewer` làm độc lập. Subagent không gọi được subagent khác, nên mọi bước chuyển giao đều đi qua main session.

## Bước 1. Phân tích yêu cầu

Chạy skill `requirement-clarify` với yêu cầu gốc. Trả báo cáo cho PO.

## Bước 2. PO duyệt (cổng bắt buộc)

Dừng tới khi PO chốt phương án và trả lời các câu hỏi mở. Không đoán thay PO. Nếu PO chốt điều mâu thuẫn với luật hiện có hoặc có rủi ro (dữ liệu, bảo mật, công bằng), nói rõ một lần, rồi làm theo quyết định của PO và ghi nó vào PRODUCT.md.

## Bước 3. Spec (main session tự làm)

1. Làm việc trên branch phát triển của session (hoặc `story/sXX-<slug>` nếu không có branch chỉ định).
2. Sửa `docs/PRODUCT.md` trước: thêm/sửa mục ở §7 với ngày và "PO duyệt"; cập nhật các mục bị ảnh hưởng.
3. Viết `docs/stories/SXX-<slug>.md` theo khung các story gần nhất: bối cảnh (trích PRODUCT), phạm vi / ngoài phạm vi, acceptance criteria đánh số, test bắt buộc (unit + e2e nếu có UI), phụ thuộc, module bị chạm. Thêm dòng vào bảng trong `docs/stories/README.md` (trạng thái ⏳).
4. Nếu story chạm contract (`docs/architecture.md`) thì ghi rõ thay đổi contract trong story và sửa `architecture.md` ngay, không để coder tự quyết.
5. Commit phần spec riêng (`docs(...)`) để PR đọc được theo thứ tự.

PO đã duyệt phương án ở bước 2 thì không cần duyệt lại story, trừ khi lúc viết spec phát sinh quyết định nghiệp vụ mới: khi đó hỏi PO trước khi gọi coder.

## Bước 4. Coder

Gọi `Agent` với `subagent_type: "coder"`, chạy foreground (bước sau phụ thuộc kết quả). Prompt gồm: đường dẫn story, branch hiện tại, các quyết định của PO chưa nằm trong file (nếu có), nhắc không commit. Không dán lại toàn bộ phân tích; story phải tự đủ.

Nếu agent `coder` chưa được nạp trong session (file agent mới tạo chỉ có hiệu lực ở session sau), dùng `subagent_type: "general-purpose"`, `model: "sonnet"`, và dán nội dung `.claude/agents/coder.md` (bỏ frontmatter) vào đầu prompt. Báo PO là đang dùng phương án dự phòng này.

## Bước 5. Reviewer

Gọi `Agent` với `subagent_type: "reviewer"` (dự phòng: `general-purpose` + nội dung `.claude/agents/reviewer.md`, không đặt model). Prompt gồm: đường dẫn story, phạm vi diff (`git diff HEAD` + file chưa track), đường dẫn scratchpad để lưu script/ảnh, kịch bản thao tác thật cần kiểm (2–5 thao tác chính lấy từ acceptance criteria). **Không** đưa báo cáo của coder, để reviewer đánh giá độc lập.

- `REQUEST_CHANGES` → gửi danh sách finding (đánh số) cho coder sửa (`SendMessage` tới agent coder cũ nếu còn, không thì gọi coder mới kèm story + findings), rồi review lại. **Tối đa 2 vòng**; quá 2 vòng thì dừng và báo PO các finding còn lại.
- `APPROVE` kèm minor/nit → main session tự quyết sửa nhanh (qua coder) hoặc ghi vào PR như việc còn lại.
- Main session tự xem lướt diff trước khi commit; không commit thứ mình chưa nhìn.

## Bước 6. Commit, push, PR

1. `npm run typecheck` và `npm test` lần cuối trên máy main.
2. Commit code (tách khỏi commit spec), message tiếng Anh, có dòng attribution theo hướng dẫn của session.
3. `git push -u origin <branch>` (thử lại khi lỗi mạng).
4. Tạo PR bằng GitHub MCP (`create_pull_request`) vào `main`. Nội dung (tiếng Việt): tóm tắt, link story và mục PRODUCT, acceptance criteria → trạng thái, kết quả review (verdict, đã thao tác thật những gì, ảnh chụp nếu đã commit vào `docs/design/`), việc còn lại / ngoài phạm vi.
5. Báo PO: link PR, những gì đã kiểm, những gì chưa kiểm được. Hỏi PO có muốn theo dõi PR không.

## Không làm

- Không gọi coder trước khi PO duyệt.
- Không để coder hoặc reviewer push, tạo PR hay sửa PRODUCT.md.
- Không bỏ qua, tắt hay nới test để xanh.
- Không merge PR.
