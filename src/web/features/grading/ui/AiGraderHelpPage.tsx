import { useNavigate } from 'react-router';
import { Card } from '../../../shared/ui/Card.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Markdown } from '../../../shared/ui/Markdown.js';

// "/admin/ai-grader-help": how to turn on AI suggestions (PRODUCT.md §7.28g). Static on purpose: it never reads or
// shows the mentor's configuration.
const GUIDE = `
**AI chấm nháp** gợi ý điểm và nhận xét cho bài tự luận. Bạn vẫn xác nhận từng bài; gợi ý không bao giờ tự thành điểm.

### Cách bật
1. Trên **máy đang chạy app**, cài Claude Code và đăng nhập. Mở terminal, thử \`claude -p "xin chào"\`: có câu trả lời là được.
2. Trong thư mục của app, chép \`config/ai-grader.example.json\` thành \`config/ai-grader.local.json\`. File \`.local.json\` không được commit.
3. Sửa \`command\` cho đúng lệnh trên máy bạn (ví dụ \`claude\` hoặc lệnh riêng của bạn) và \`args\` nếu cần model hay file setting riêng. Đọc phần \`_readme\` trong file mẫu.
4. Tải lại trang chấm. Không cần khởi động lại app.

### Cần biết
- AI cần **internet**. Mất mạng thì bài báo lỗi, bạn chấm tay như thường.
- App chỉ gửi **đề, rubric và nội dung bài**. Không gửi tên, email hay thông tin nào khác của học viên.
- AI chạy **không có công cụ**: không đọc file, không chạy lệnh trên máy bạn. App từ chối cấu hình có các cờ mở quyền (xem file mẫu).
- Câu tự luận phải có **rubric** trong đề. Viết rubric thành danh sách tiêu chí kèm điểm, ví dụ \`- Nêu được X (1,5đ)\`, để AI chấm theo từng tiêu chí.
- Mỗi lần chạy dùng hạn mức tài khoản AI của bạn.
`;

export function AiGraderHelpPage() {
  const nav = useNavigate();
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 760 }}>
      <button onClick={() => nav(-1)} style={{ justifySelf: 'start', display: 'inline-flex', gap: 6, alignItems: 'center', background: 'none', border: 0, padding: 0, color: 'var(--text-meta)', font: 'var(--type-meta)', cursor: 'pointer' }}>
        <Icon name="arrow-left" size={14} />Quay lại
      </button>
      <h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0, display: 'inline-flex', gap: 10, alignItems: 'center' }}>
        <Icon name="sparkles" size={24} />Bật AI chấm nháp
      </h1>
      <Card><Markdown source={GUIDE} /></Card>
    </div>
  );
}
