/** How a failed join attempt is explained to the member (and which field it belongs to). */
export type JoinFailure =
  | { kind: 'locked'; seconds: number } // too many wrong room codes (server 429)
  | { kind: 'room' }
  | { kind: 'name'; message: string };

/** Seconds to wait from the join limiter's 429 message ("… Thử lại sau 42 giây"); 0 when not found. */
export function retrySecondsFrom(message: string): number {
  const m = /(\d+)\s*giây/.exec(message);
  return m ? Number(m[1]) : 0;
}

/** `status` is the HTTP status (0 = no connection), or null when the error did not come from the API at all. */
export function classifyJoinError(status: number | null, message: string): JoinFailure {
  if (status === null) return { kind: 'name', message: 'Không vào được phiên' };
  if (status === 429) return { kind: 'locked', seconds: retrySecondsFrom(message) || 30 };
  if (status === 403 || /mã phòng/i.test(message)) return { kind: 'room' };
  if (status === 409) return { kind: 'name', message: `${message}. Thêm họ hoặc một chữ để phân biệt.` };
  return { kind: 'name', message };
}

/** How a failed room-code lookup is explained under the code field. `status` 0 = no connection. */
export type RoomLookupFailure =
  | { kind: 'locked'; seconds: number } // too many wrong codes from this address (server 429)
  | { kind: 'wrong'; message: string }
  | { kind: 'offline'; message: string }
  | { kind: 'other'; message: string };

export function classifyRoomLookupError(status: number, message: string): RoomLookupFailure {
  if (status === 429) return { kind: 'locked', seconds: retrySecondsFrom(message) || 30 };
  if (status === 403) return { kind: 'wrong', message: 'Mã phòng không đúng. Kiểm tra lại 6 số trên màn chiếu.' };
  if (status === 0) return { kind: 'offline', message: 'Mất kết nối tới máy mentor. Những gì bạn đã gõ vẫn còn, thử lại sau ít giây.' };
  return { kind: 'other', message: message || 'Không tìm được phòng' };
}
