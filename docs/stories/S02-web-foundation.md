# S02 — Nền tảng web

**Phụ thuộc:** — · **Song song với:** S01

## Bối cảnh
Các story UI sau dùng chung router, API client, component Markdown và layout. Contract: [architecture.md §1, §8](../architecture.md).

## Phạm vi
- Cài `react-router`, `tailwindcss` + `@tailwindcss/vite`, `react-markdown`, `remark-gfm`, `rehype-highlight`, `highlight.js`.
- Router (`createBrowserRouter`) với route khung cho mọi đường dẫn ở §8, mỗi route tạm là trang placeholder có tiêu đề.
- Layout: `MemberLayout` (tối giản, mobile-first), `AdminLayout` (thanh điều hướng: Đề thi, Phiên thi), `ScreenLayout` (toàn màn hình, chữ lớn).
- _(Đã chuyển ở epic #7: nay là `src/web/shared/api-client/` + `shared/token-store/`, xem architecture §12.)_ Ban đầu `src/web/lib/api.ts`: `api.get/post/put/patch/delete<T>(path, body?)`; tự gắn header `X-Participant-Token` khi có token cho session tương ứng (helper `setParticipantToken(sessionId, token)`, `getParticipantToken(sessionId)` dùng localStorage, bọc try/catch); lỗi HTTP → ném `ApiError { status, message }` lấy từ `{ error }`.
- `<Markdown source>`: render GFM + highlight code, import CSS theme highlight.js từ package (không CDN), class Tailwind typography cơ bản tự viết (không thêm plugin typography).
- Chuyển `src/shared/api.ts` thành thư mục `src/shared/api/` (`health.ts` + `index.ts`), cập nhật import.
- Component dùng chung tối thiểu: `Button`, `Card`, `ErrorMessage`, `Spinner`.

## Ngoài phạm vi
Logic gọi API thật của từng màn hình, trang login (S03).

## Acceptance criteria
- [x] `npm run dev` → mọi route §8 mở được, F5 ở route con không 404 (dev và `npm start`).
- [x] `npm run build` không có request ra ngoài (kiểm tra `dist/web` không chứa URL `http(s)://` tới CDN/font).
- [x] `<Markdown>` render đúng code block có highlight, bảng GFM, inline code.
- [x] Giao diện dùng được ở bề ngang 360px.

## Test bắt buộc
- `api.ts`: ném `ApiError` đúng status/message (mock `fetch`), gắn header token đúng session.
