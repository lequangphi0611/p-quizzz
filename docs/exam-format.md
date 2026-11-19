# Định dạng file đề thi (Markdown)

> Spec chính thức của format đề. Parser: `src/shared/exam-format/parse.ts` — khi đổi format phải sửa cả hai và test.
> Ví dụ đầy đủ: [`exams/examples/git-co-ban.md`](../exams/examples/git-co-ban.md); câu có hỏi lý do: [`exams/examples/react-hooks-ly-do.md`](../exams/examples/react-hooks-ly-do.md).

File bạn duyệt **chính là** file được import. Không có bước chuyển đổi.

## Cấu trúc

```markdown
---
title: Tên đề (bắt buộc)
description: Mô tả ngắn (tuỳ chọn)
duration: 30
---

## Tiêu đề câu hỏi {thuộc tính tuỳ chọn}
Nội dung thêm (tuỳ chọn): đoạn văn, danh sách, code block...
- [ ] Đáp án sai
- [x] Đáp án đúng
> Giải thích (trắc nghiệm) hoặc đáp án mẫu + rubric (tự luận)
```

### Frontmatter

| Key | Bắt buộc | Ghi chú |
|---|---|---|
| `title` | Có | Tên đề, member và màn hình chiếu thấy. |
| `description` | Không | Mô tả ngắn. |
| `duration` | Không | Thời gian làm bài, **số nguyên phút** từ 1 đến 300 (ví dụ `duration: 45`). Đây là giá trị **mặc định** khi mentor tạo phiên, mentor sửa hoặc tắt được. Bỏ trống (`duration:`) hoặc không có key = không giới hạn thời gian. |

Mỗi câu hỏi gồm các phần **theo đúng thứ tự**: tiêu đề → nội dung (tuỳ chọn) → đáp án → giải thích (tuỳ chọn).

| Phần | Cú pháp | Ghi chú |
|---|---|---|
| Tiêu đề | `## ...` | Bắt đầu một câu hỏi. Chỉ dùng `##` — không dùng `#`, `###`. |
| Thuộc tính | `{essay}`, `{points=3}`, `{essay, points=5}`, `{reason}`, `{reason, points=2}` | Ở **cuối** dòng tiêu đề. Chỉ có 3 key: `essay`, `points` (số nguyên 1–100, mặc định 1), `reason` (câu trắc nghiệm hỏi thêm lý do, xem dưới). Key lạ là lỗi. |
| Nội dung | Markdown bất kỳ | Code block (```` ``` ````) viết bình thường ở đây (không có `>`). Không dùng `>` trong phần này. |
| Đáp án | `- [ ] ...` / `- [x] ...` | **Mỗi đáp án 1 dòng**, hỗ trợ Markdown inline (`code`, **đậm**). |
| Giải thích | Các dòng `> ...` | Luôn ở cuối câu. Nhiều đoạn: ngăn cách bằng dòng `>` trống hoặc dòng trống. Được dùng code block (vd: code đáp án mẫu của câu tự luận) nếu **mọi dòng** của block, kể cả dòng ```` ``` ```` và dòng trống bên trong, đều bắt đầu bằng `>`. |

## Loại câu hỏi (suy ra tự động)

| Điều kiện | Loại | Chấm |
|---|---|---|
| Đúng 1 `[x]` | Trắc nghiệm 1 đáp án | Tự động |
| ≥ 2 `[x]` | Trắc nghiệm nhiều đáp án | Tự động — phải chọn đúng **chính xác** tập đáp án đúng |
| `{essay}`, không có đáp án | Tự luận / code | Mentor chấm tay theo rubric |

### Hỏi lý do: `{reason}`

Câu trắc nghiệm (một hoặc nhiều đáp án) có `{reason}` thì member thấy thêm ô **lý do** dưới các đáp án ([PRODUCT.md §7.32](PRODUCT.md)). Đã chọn đáp án thì **bắt buộc** ghi lý do (tối đa 200 ký tự); lý do **không tính điểm**. Mentor đọc lý do sau khi đóng phiên và chiếu ẩn danh trong chế độ thảo luận.

```markdown
## Cách nào phù hợp nhất để có danh sách đã lọc? {reason}
- [ ] Dùng `useState` + `useEffect` để lưu danh sách đã lọc
- [x] Tính thẳng `products.filter(...)` trong thân component
- [ ] Bắt buộc bọc trong `useMemo`
> Dữ liệu suy ra được từ props/state thì tính khi render.
```

`{reason}` không dùng được với `{essay}` (lỗi) và không nhận giá trị.

## Kiểm tra trước khi import

```bash
npm run exam:check -- exams/ten-de.md
```

**Lỗi** (không import được): thiếu frontmatter/title · `duration` không phải số nguyên phút từ 1 đến 300 · nội dung ngoài câu hỏi · câu trắc nghiệm < 2 đáp án hoặc không có `[x]` · câu không có đáp án mà không có `{essay}` · tự luận có đáp án · thuộc tính lạ / points sai / `reason` trên câu tự luận · dòng lạ giữa/sau danh sách đáp án · nội dung sau phần giải thích · code block sau đáp án hoặc chưa đóng · sai cấp tiêu đề · đáp án trùng · câu hỏi trùng.

**Cảnh báo** (vẫn import được, nên sửa): thiếu giải thích · tự luận thiếu rubric · tất cả đáp án đều đúng · đáp án kiểu "tất cả các đáp án trên" / "A và B" (sai nghĩa khi đáp án bị trộn) · key frontmatter không dùng · ảnh trỏ tới địa chỉ bên ngoài (`![](https://...)`; app chạy offline trong LAN nên ảnh ngoài luôn bị chặn và hiện chữ "Ảnh ngoài bị chặn").

## Lưu ý

- Đáp án luôn được **trộn thứ tự** khi thi → không viết đáp án phụ thuộc vị trí hay tham chiếu đáp án khác.
- Mỗi member chỉ làm **1 lần** trong mỗi phiên (muốn làm lại, mentor mở phiên mới). Đề có tự luận thì mentor phải chấm tay.
- Đề thật lưu trong `exams/` (đã gitignore vì chứa đáp án). Chỉ `exams/examples/` được commit.
