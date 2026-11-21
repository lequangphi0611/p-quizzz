import type { FlagCode, MemberFlag, TrainingDetail, TrainingMemberRow, TrainingEventRow } from '../../../../shared/api/index.js';
import { FLAG_CODES } from '../../../../shared/api/index.js';

export interface FlagInfo {
  /** Names a behaviour, never the person, and never a verdict (PRODUCT.md §7.35c). */
  label: string;
  /** What the mentor is looking at, and what the hint cannot tell. */
  hint: string;
  icon: string;
}

export const FLAG_INFO: Record<FlagCode, FlagInfo> = {
  repeated_failure: { label: 'Lặp lệnh lỗi', hint: 'Cùng một lệnh lỗi từ 3 lần liên tiếp.', icon: 'rotate-ccw' },
  long_without_verify: { label: 'Lâu chưa qua kiểm tra', hint: 'Sửa nhiều file trong hơn 10 phút mà chưa có lần chạy test, build hay lint nào thành công.', icon: 'hourglass' },
  edited_not_verified: { label: 'Sửa xong chưa chạy kiểm tra', hint: 'Gợi ý mờ: nhiều lượt có sửa file mà không chạy test, build hay lint. Có thể bạn ấy chạy ở cửa sổ khác, app không thấy.', icon: 'list-checks' },
  auto_accept: { label: 'Chế độ tự chấp nhận', hint: 'Claude Code chạy ở chế độ không hỏi lại trước khi sửa file hoặc chạy lệnh.', icon: 'shield-alert' },
  fast_approvals: { label: 'Đồng ý quyền rất nhanh', hint: 'Từ 3 lần đồng ý trong chưa đầy 2 giây (suy ra, sai số vài trăm mili giây).', icon: 'clock' },
  repeated_request: { label: 'Lặp yêu cầu', hint: 'Từ 3 prompt liên tiếp gần giống nhau, hoặc chỉ báo "vẫn lỗi".', icon: 'refresh-cw' },
  auto_compact_repeated: { label: 'Hội thoại tự nén nhiều lần', hint: 'Claude Code tự nén hội thoại từ 2 lần mà chưa có lần /clear nào.', icon: 'shuffle' },
  dangerous_command: { label: 'Lệnh nguy hiểm', hint: 'Lệnh có thể xoá hoặc ghi đè công việc, hoặc bỏ qua bước kiểm tra an toàn (gồm cả lệnh được xin quyền nhưng không chạy).', icon: 'triangle-alert' },
  touches_tests: { label: 'Đụng vào test', hint: 'Thêm skip, xoá ca test hoặc xoá file test.', icon: 'pencil' },
  possible_secret: { label: 'Có thể lộ bí mật', hint: 'Prompt, lệnh, nội dung sửa hoặc output có chuỗi giống khoá hay mật khẩu.', icon: 'key-round' },
};

/**
 * The flags shown next to a member. "Lặp lệnh lỗi" yields to the "Có thể đang kẹt" chip while the member is stuck right now:
 * the two say nearly the same thing and the second says it is happening.
 */
export const visibleFlags = (m: Pick<TrainingMemberRow, 'flags' | 'stuck'>): FlagCode[] => m.flags.filter(c => !(c === 'repeated_failure' && m.stuck));

export interface FlagTotal { code: FlagCode; count: number; total: number }

/** "6/10 bạn có cờ Lặp yêu cầu": the flags that at least one member has, in the fixed order, as counts only (no names, no comparison). */
export function flagTotals(detail: Pick<TrainingDetail, 'flagCounts' | 'members'>): FlagTotal[] {
  const total = detail.members.length;
  return FLAG_CODES.filter(code => (detail.flagCounts[code] ?? 0) > 0).map(code => ({ code, count: detail.flagCounts[code], total }));
}

/** The loaded events that justify a flag, in the order they happened (ids the page does not have yet are skipped). */
export function evidenceOf(flag: MemberFlag | undefined, events: readonly Pick<TrainingEventRow, 'id'>[]): number[] {
  if (!flag) return [];
  const have = new Set(events.map(e => e.id));
  return flag.eventIds.filter(id => have.has(id));
}
