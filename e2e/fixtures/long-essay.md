---
title: Đề e2e — tự luận dài
description: Fixture cho e2e màn thảo luận; câu tự luận có đề dài và đáp án mẫu là code dòng dài.
---

## Câu trắc nghiệm mở đầu
- [x] Đúng
- [ ] Sai
> Câu này chỉ để đề có cả hai loại câu.

## Refactor code kiểu Java bằng scope functions {essay, points=8}

Đoạn code dưới đây chạy đúng nhưng viết theo kiểu "Java khoác áo Kotlin":

```kotlin
class Report {
    var title: String = ""
    var author: String = ""
    var tags: MutableList<String> = mutableListOf()
}

fun buildReport(rawTitle: String?, author: String): Report {
    val report = Report()
    report.title = "Untitled"
    if (rawTitle != null) {
        val trimmed = rawTitle.trim()
        if (trimmed.isNotEmpty()) {
            report.title = trimmed.uppercase()
        }
    }
    report.author = author
    report.tags.add("draft")
    println("Created report: " + report.title)
    return report
}
```

1. Viết lại hàm `buildReport` cho idiomatic, dùng ít nhất `apply` và `also`.
2. Giải thích vì sao bạn chọn từng scope function ở từng vị trí.
3. Nêu một tình huống mà việc dùng scope function làm code **khó đọc hơn**.

> **Đáp án mẫu:**
>
> ```kotlin
> fun buildReport(rawTitle: String?, author: String): Report = Report().apply {
>     title = rawTitle?.trim()?.takeIf { it.isNotEmpty() }?.uppercase() ?: "Untitled"
>     this.author = author
>     tags += "draft"
> }.also { println("Created report: ${it.title}") }
> ```
>
> **Rubric (8đ):**
> - Dùng `apply` để cấu hình object (cần `this` và cần trả về chính object): 2đ.
> - Dùng `also` cho side-effect (log) mà không đổi giá trị trả về: 1,5đ.
> - Xử lý null/rỗng bằng chuỗi `?.` / `takeIf` / `?:` và giữ đúng hành vi: 2đ.
> - Giải thích vì sao chọn từng hàm: 1đ.
> - Nêu được tình huống khó đọc: 1,5đ.
