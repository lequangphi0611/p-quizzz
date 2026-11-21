/** How a failed `join` is explained to the member (and what the form does about it). */
export type TrainingJoinFailure =
  | { kind: 'locked'; seconds: number } // too many wrong codes from this address (429)
  | { kind: 'taken'; message: string } // someone already joined with this name: pick another (409 `identity_in_use`)
  | { kind: 'room'; message: string } // wrong code, or the training stopped under the member (403, neutral on purpose)
  | { kind: 'offline'; message: string }
  | { kind: 'name'; message: string }; // other, shown under the name field

/** Seconds to wait from the limiter's 429 message ("… Thử lại sau 42 giây"); 0 when not found. */
export function retrySecondsFrom(message: string): number {
  const m = /(\d+)\s*giây/.exec(message);
  return m ? Number(m[1]) : 0;
}

export const TRAINING_ROOM_NOT_FOUND = 'Mã phòng không đúng, hoặc buổi training không còn nhận người vào. Hỏi lại mentor.';

/** `status` is the HTTP status (0 = no connection), or null when the error did not come from the API at all. */
export function classifyTrainingJoinError(status: number | null, message: string, code?: string): TrainingJoinFailure {
  if (status === null) return { kind: 'name', message: 'Không vào được buổi training' };
  if (status === 429) return { kind: 'locked', seconds: retrySecondsFrom(message) || 30 };
  if (status === 409 && code === 'identity_in_use') {
    return { kind: 'taken', message: 'Tên này đã có người dùng trong buổi. Chọn tên khác, ví dụ thêm họ hoặc một chữ để phân biệt.' };
  }
  // Wrong code and "not open any more" read the same (PRODUCT.md §7.16): never say which.
  if (status === 403) return { kind: 'room', message: TRAINING_ROOM_NOT_FOUND };
  if (status === 0) return { kind: 'offline', message: 'Mất kết nối tới máy mentor. Tên bạn đã gõ vẫn còn, thử lại sau ít giây.' };
  return { kind: 'name', message: message || 'Không vào được buổi training' };
}
