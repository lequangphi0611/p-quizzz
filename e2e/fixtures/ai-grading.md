---
title: Ôn tập Git cơ bản
description: Fixture cho e2e AI chấm nháp (S26). Câu 2 có rubric tách được tiêu chí, câu 3 không có rubric.
---

## Lệnh nào vừa tạo branch mới vừa chuyển sang branch đó?
- [ ] `git branch feature`
- [x] `git checkout -b feature`
- [ ] `git merge feature`
> `checkout -b` tạo rồi chuyển luôn.

## Khi nào nên dùng `merge`, khi nào nên dùng `rebase`? Nêu một rủi ro của `rebase`. {essay, points=5}
> Merge cho nhánh dùng chung, giữ nguyên lịch sử. Rebase để dọn nhánh cá nhân trước khi mở PR. Rủi ro: viết lại commit đã push.
>
> - Merge giữ nguyên lịch sử, tạo merge commit, phù hợp nhánh dùng chung (1,5đ)
> - Rebase làm lịch sử thẳng, phù hợp nhánh cá nhân trước khi mở PR (1,5đ)
> - Rủi ro: rebase nhánh đã push làm viết lại lịch sử, gây xung đột cho người khác (2đ)

## Bạn đang sửa dở thì cần chuyển nhánh gấp. Dùng `git stash` thế nào? {essay, points=3}
