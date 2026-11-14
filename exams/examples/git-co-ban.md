---
title: Ôn tập Git cơ bản
description: Ví dụ minh hoạ đủ các loại câu hỏi của format đề.
---

## Lệnh nào vừa tạo branch mới vừa chuyển sang branch đó?
- [ ] `git branch feature`
- [x] `git checkout -b feature`
- [ ] `git merge feature`
- [ ] `git fetch feature`
> `git checkout -b` (hoặc `git switch -c`) tạo branch rồi chuyển sang ngay. `git branch` chỉ tạo, không chuyển; `merge` và `fetch` không tạo branch.

## Những lệnh nào tạo ra commit mới thay vì giữ nguyên commit cũ? {points=2}
- [x] `git commit --amend`
- [x] `git rebase main`
- [ ] `git log`
- [ ] `git status`
> `--amend` thay commit cuối bằng commit mới; `rebase` chép lại các commit lên base mới (hash đổi). `log` và `status` chỉ đọc.

## Sau khi chạy đoạn lệnh sau, `git status` hiển thị file `a.txt` ở trạng thái nào?

```bash
echo "hello" > a.txt
git add a.txt
echo "world" >> a.txt
```

- [ ] Chỉ ở "Changes to be committed"
- [ ] Chỉ ở "Changes not staged for commit"
- [x] Xuất hiện ở cả hai mục
- [ ] Untracked
> Bản có "hello" đã được stage; dòng "world" thêm sau `git add` nên là thay đổi chưa stage. Vì vậy file nằm ở cả hai mục.

## Khi nào nên dùng `merge`, khi nào nên dùng `rebase`? Nêu một rủi ro của `rebase`. {essay, points=5}
> **Đáp án mẫu:** merge giữ nguyên lịch sử, tạo merge commit — hợp với branch dùng chung. Rebase cho lịch sử thẳng — hợp để cập nhật branch cá nhân trước khi mở PR.
>
> **Rubric (5đ):** 2đ đúng bản chất merge · 2đ đúng bản chất rebase · 1đ nêu rủi ro: rebase branch đã push/dùng chung làm người khác bị lệch lịch sử.
