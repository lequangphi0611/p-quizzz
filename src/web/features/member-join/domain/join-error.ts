/** How a failed join attempt is explained to the member (and which field it belongs to). */
export type JoinFailure =
  | { kind: 'locked'; seconds: number } // too many wrong room codes / emails (server 429)
  | { kind: 'room' }
  | { kind: 'email'; message: string } // not on the list, or not an email: belongs under the email field
  | { kind: 'taken'; message: string } // the email or name already has someone in the room (`identity_in_use`)
  | { kind: 'name'; message: string };

/** Seconds to wait from the join limiter's 429 message ("… Thử lại sau 42 giây"); 0 when not found. */
export function retrySecondsFrom(message: string): number {
  const m = /(\d+)\s*giây/.exec(message);
  return m ? Number(m[1]) : 0;
}

/** `status` is the HTTP status (0 = no connection), or null when the error did not come from the API at all. */
export function classifyJoinError(status: number | null, message: string, code?: string): JoinFailure {
  if (status === null) return { kind: 'name', message: 'Không vào được phiên' };
  if (status === 429) return { kind: 'locked', seconds: retrySecondsFrom(message) || 30 };
  // One message for every email that is not on the list (the server never says why): show it as it is.
  if (status === 403 && /danh sách/i.test(message)) return { kind: 'email', message };
  if (status === 403 || /mã phòng/i.test(message)) return { kind: 'room' };
  if (status === 400 && /email/i.test(message)) return { kind: 'email', message };
  if (status === 409 && code === 'identity_in_use') return { kind: 'taken', message };
  // The session closed (or was never open) under the member: back to the room-code step, not a name problem.
  if (status === 409 && /không mở/i.test(message)) return { kind: 'room' };
  // Only a name clash is fixed by a more distinct name; any other conflict is shown as it is.
  if (status === 409 && /tên/i.test(message) && /dùng/i.test(message)) return { kind: 'name', message: `${message}. Thêm họ hoặc một chữ để phân biệt.` };
  return { kind: 'name', message };
}

export const ROOM_NOT_FOUND = 'Không tìm thấy phòng đang mở với mã này. Kiểm tra lại mã, hoặc phiên đã kết thúc.';

/** How a failed room-code lookup is explained under the code field. `status` 0 = no connection. */
export type RoomLookupFailure =
  | { kind: 'locked'; seconds: number } // too many wrong codes from this address (server 429)
  | { kind: 'wrong'; message: string }
  | { kind: 'offline'; message: string }
  | { kind: 'other'; message: string };

export function classifyRoomLookupError(status: number, message: string): RoomLookupFailure {
  if (status === 429) return { kind: 'locked', seconds: retrySecondsFrom(message) || 30 };
  // A wrong code and an ended session's code read the same (PRODUCT.md §7.16): never tell which, never blame the typing.
  if (status === 403) return { kind: 'wrong', message: ROOM_NOT_FOUND };
  if (status === 0) return { kind: 'offline', message: 'Mất kết nối tới máy mentor. Những gì bạn đã gõ vẫn còn, thử lại sau ít giây.' };
  return { kind: 'other', message: message || 'Không tìm được phòng' };
}
