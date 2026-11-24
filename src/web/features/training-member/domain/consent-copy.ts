/**
 * What the consent screen tells the member (PRODUCT.md §7.34 b, c, g, i). Kept as data so a test can hold the screen to
 * the contract: every kind of data is listed, secrets are named, and nothing is promised that the server does not do.
 */
export interface ConsentItem {
  icon: string;
  /** Bold start of the line. */
  lead: string;
  text: string;
}

/** "Những gì được gửi về máy mentor". */
export const SENT_ITEMS: readonly ConsentItem[] = [
  { icon: 'message-square', lead: 'Prompt', text: 'mỗi câu bạn gõ cho Claude Code.' },
  { icon: 'code', lead: 'Mỗi lần Claude dùng công cụ', text: '(Bash hoặc PowerShell, Edit, Write, Read…): tên công cụ, câu lệnh hoặc tên file (đường dẫn tính từ thư mục bài tập), lệnh chạy xong hay bị lỗi (pass/fail) và mất bao lâu.' },
  { icon: 'file-text', lead: 'Output của lệnh và nội dung thay đổi file', text: '(phần Edit/Write). Nếu dài, chỉ giữ phần đầu và phần cuối.' },
  { icon: 'eye-off', lead: 'Công cụ đọc file (Read)', text: 'chỉ gửi tên file và số dòng đã đọc, không gửi nội dung file.' },
  { icon: 'shield-alert', lead: 'Mỗi lần Claude xin quyền', text: 'công cụ và câu lệnh hoặc nội dung sửa file mà Claude xin chạy. App suy ra bạn cho phép hay từ chối (và bạn bấm sau bao lâu) từ việc lệnh có chạy hay không.' },
  { icon: 'message-square', lead: 'Câu Claude hỏi và lựa chọn của bạn', text: 'cùng kế hoạch Claude trình khi ở chế độ lập kế hoạch. Chữ bạn góp ý khi từ chối kế hoạch không được gửi.' },
  { icon: 'refresh-cw', lead: 'Phiên Claude Code', text: 'khi bạn gõ /clear, /compact (kèm chữ bạn gõ sau đó), /model hoặc thoát; khi Claude tự nén hội thoại; khi Claude đang chờ bạn; và chế độ quyền đang dùng (hỏi từng lần, tự chấp nhận, lập kế hoạch…).' },
];

/** "Những gì không gửi". */
export const NOT_SENT_ITEMS: readonly ConsentItem[] = [
  { icon: 'lock', lead: 'Câu trả lời của Claude', text: 'không được gửi, kể cả bản tóm tắt Claude viết khi nén hội thoại.' },
  { icon: 'door-open', lead: 'Phiên Claude Code mở ở thư mục khác', text: 'không gửi gì (cấu hình chỉ có trong thư mục bài tập).' },
];

/** The honest exception to the line above: it is about where Claude Code was opened, not about what a command touches. */
export const OTHER_FOLDER_CAVEAT =
  'Lưu ý: nếu Claude Code đang mở trong thư mục bài tập mà chạy lệnh đụng tới chỗ khác trên máy (ví dụ đọc một file ở thư mục nhà), lệnh đó vẫn được gửi, kèm output.';

/**
 * The risk of the permission hook, said plainly (PRODUCT.md §7.35f, spike §6.2). Tested: an answer from the server can approve
 * a command on this machine. The app's own server never does, but it is the address that decides, not the app.
 */
export const PERMISSION_RISK_TITLE = 'Rủi ro: hook xin quyền';
export const PERMISSION_RISK =
  'Cấu hình có một hook chạy mỗi khi Claude xin quyền. Nếu máy nào trả lời ở địa chỉ máy mentor trả về quyết định "cho phép", Claude Code sẽ tự chạy lệnh trên máy bạn mà không hỏi bạn. App của mentor không bao giờ làm vậy, nhưng nếu bạn quên gỡ cấu hình và địa chỉ đó thuộc về máy khác, máy đó làm được. Vì vậy hãy gỡ cấu hình ngay khi buổi training xong.';

/** Said once, plainly, not in small print. */
export const SECRET_WARNING =
  'Output của lệnh và nội dung file có thể chứa mật khẩu hoặc mã bí mật nếu chúng xuất hiện ở đó. Đừng chạy lệnh in ra bí mật trong thời gian buổi training.';

/** "Ai xem, giữ bao lâu, rút lại thế nào". */
export const HANDLING_ITEMS: readonly ConsentItem[] = [
  { icon: 'eye', lead: 'Chỉ mentor xem.', text: 'Bạn không xem lại được dữ liệu đã gửi, và các bạn khác cũng không xem được.' },
  { icon: 'calendar', lead: 'Buổi có thể kéo dài nhiều ngày.', text: 'Mọi prompt và lệnh trong thư mục bài tập đều được gửi, kể cả ngoài giờ học, cho tới khi mentor dừng thu hoặc bạn dừng gửi.' },
  { icon: 'trash-2', lead: 'Xoá khi mentor bấm "Kết thúc".', text: 'Trước đó dữ liệu được giữ trên máy mentor.' },
  { icon: 'log-out', lead: 'Dừng gửi bất cứ lúc nào:', text: 'máy mentor không nhận thêm gì từ bạn. Dữ liệu đã gửi chỉ bị xoá khi mentor duyệt xoá hoặc khi mentor bấm "Kết thúc", và mentor biết tên người đã dừng. Sau đó bạn gỡ cấu hình khỏi thư mục bài tập (trang sẽ hướng dẫn).' },
  { icon: 'wifi', lead: 'Đi qua mạng nội bộ (Wi-Fi/LAN) không mã hoá.', text: 'Người khác trong cùng mạng có thể có cách đọc được.' },
  { icon: 'file-text', lead: 'Mentor có thể xuất báo cáo có tên bạn', text: 'lưu trên máy mentor.' },
  { icon: 'user-check', lead: 'Không tham gia vẫn học bình thường.', text: 'Mentor không thấy tên người không tham gia.' },
];
