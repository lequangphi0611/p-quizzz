---
title: Ôn tập React hooks (có hỏi lý do)
description: Ví dụ câu trắc nghiệm có ô lý do `{reason}` (PRODUCT.md §7.32).
---

## Cách nào phù hợp nhất để có danh sách sản phẩm đã lọc? {reason}
Trang có khoảng 50 sản phẩm (`products`, lấy từ props) và một ô tìm kiếm (`query`, là state). Danh sách hiển thị chỉ gồm các sản phẩm có tên chứa `query`.
- [ ] Tạo state `visible` rồi dùng `useEffect` để gán `products.filter(...)` mỗi khi `products` hoặc `query` đổi
- [x] Viết thẳng `const visible = products.filter(p => p.name.includes(query))` trong thân component
- [ ] Bắt buộc bọc phép lọc trong `useMemo`, vì nếu không nó chạy lại mỗi lần render
- [ ] Lưu kết quả lọc vào `useRef` để tránh re-render
> Dữ liệu suy ra được từ props/state thì tính ngay khi render. Thêm state + effect gây một lần render thừa và dễ lệch dữ liệu; lọc 50 phần tử mỗi lần render không đáng kể nên chưa cần `useMemo`.

## Hook nào dùng để giữ một giá trị qua các lần render mà thay đổi nó **không** gây render lại?
- [ ] `useState`
- [x] `useRef`
- [ ] `useMemo`
- [ ] `useContext`
> `useRef` trả về object giữ nguyên qua các lần render; gán `ref.current` không kích hoạt render. Đổi state bằng `useState` thì có.

## Những trường hợp nào nên dùng `useEffect`? {reason, points=2}
- [x] Đăng ký và huỷ đăng ký sự kiện `resize` của cửa sổ trình duyệt
- [ ] Tính tổng tiền giỏ hàng từ danh sách sản phẩm trong state
- [x] Gọi API lấy dữ liệu khi component hiện ra lần đầu
- [ ] Đặt lại state khi người dùng bấm một nút
> Effect dùng để đồng bộ với hệ thống bên ngoài React (API trình duyệt, mạng). Giá trị tính được từ state thì tính khi render; việc do người dùng bấm thì xử lý trong event handler.
