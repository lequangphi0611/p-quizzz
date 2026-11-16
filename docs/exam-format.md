# Định dạng file đề thi (Markdown)

> Spec chính thức của format đề. Parser: `src/shared/exam-format/parse.ts` — khi đổi format phải sửa cả hai và test.
> Ví dụ đầy đủ: [`exams/examples/git-co-ban.md`](../exams/examples/git-co-ban.md).

File bạn duyệt **chính là** file được import. Không có bước chuyển đổi.

## Cấu trúc

```markdown
---
title: Tên đề (bắt buộc)
description: Mô tả ngắn (tuỳ chọn)
---

## Tiêu đề câu hỏi {thuộc tính tuỳ chọn}
Nội dung thêm (tuỳ chọn): đoạn văn, danh sách, code block...
- [ ] Đáp án sai
- [x] Đáp án đúng
> Giải thích (trắc nghiệm) hoặc đáp án mẫu + rubric (tự luận)
```

Mỗi câu hỏi gồm các phần **theo đúng thứ tự**: tiêu đề → nội dung (tuỳ chọn) → đáp án → giải thích (tuỳ chọn).

| Phần | Cú pháp | Ghi chú |
|---|---|---|
| Tiêu đề | `## ...` | Bắt đầu một câu hỏi. Chỉ dùng `##` — không dùng `#`, `###`. |
| Thuộc tính | `{essay}`, `{points=3}`, `{essay, points=5}` | Ở **cuối** dòng tiêu đề. Chỉ có 2 key: `essay`, `points` (số nguyên 1–100, mặc định 1). Key lạ là lỗi. |
| Nội dung | Markdown bất kỳ | Code block (```` ``` ````) chỉ được đặt ở đây. Không dùng `>` trong phần này. |
| Đáp án | `- [ ] ...` / `- [x] ...` | **Mỗi đáp án 1 dòng**, hỗ trợ Markdown inline (`code`, **đậm**). |
| Giải thích | Các dòng `> ...` | Luôn ở cuối câu. Nhiều đoạn: ngăn cách bằng dòng `>` trống hoặc dòng trống. |

## Loại câu hỏi (suy ra tự động)

| Điều kiện | Loại | Chấm |
|---|---|---|
| Đúng 1 `[x]` | Trắc nghiệm 1 đáp án | Tự động |
| ≥ 2 `[x]` | Trắc nghiệm nhiều đáp án | Tự động — phải chọn đúng **chính xác** tập đáp án đúng |
| `{essay}`, không có đáp án | Tự luận / code | Mentor chấm tay theo rubric |

## Kiểm tra trước khi import

```bash
npm run exam:check -- exams/ten-de.md
```

**Lỗi** (không import được): thiếu frontmatter/title · nội dung ngoài câu hỏi · câu trắc nghiệm < 2 đáp án hoặc không có `[x]` · câu không có đáp án mà không có `{essay}` · tự luận có đáp án · thuộc tính lạ / points sai · dòng lạ giữa/sau danh sách đáp án · nội dung sau phần giải thích · code block sau đáp án hoặc chưa đóng · sai cấp tiêu đề · đáp án trùng · câu hỏi trùng.

**Cảnh báo** (vẫn import được, nên sửa): thiếu giải thích · tự luận thiếu rubric · tất cả đáp án đều đúng · đáp án kiểu "tất cả các đáp án trên" / "A và B" (sai nghĩa khi đáp án bị trộn) · key frontmatter không dùng · ảnh trỏ tới địa chỉ bên ngoài (`![](https://...)`; app chạy offline trong LAN nên ảnh ngoài luôn bị chặn và hiện chữ "Ảnh ngoài bị chặn").

## Lưu ý

- Đáp án luôn được **trộn thứ tự** khi thi → không viết đáp án phụ thuộc vị trí hay tham chiếu đáp án khác.
- Mỗi member chỉ làm **1 lần** trong mỗi phiên (muốn làm lại, mentor mở phiên mới). Đề có tự luận thì mentor phải chấm tay.
- Đề thật lưu trong `exams/` (đã gitignore vì chứa đáp án). Chỉ `exams/examples/` được commit.
