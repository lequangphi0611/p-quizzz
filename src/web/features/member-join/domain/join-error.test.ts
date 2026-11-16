import { describe, expect, it } from 'vitest';
import { classifyJoinError, classifyRoomLookupError, retrySecondsFrom } from './join-error.js';

describe('retrySecondsFrom', () => {
  it('reads the wait from the 429 message', () => {
    expect(retrySecondsFrom('Nhập sai mã phòng quá nhiều lần. Thử lại sau 42 giây')).toBe(42);
    expect(retrySecondsFrom('Mã phòng không đúng')).toBe(0);
  });
});

describe('classifyJoinError', () => {
  it('locks for the server-given wait, or 30s when the message has none', () => {
    expect(classifyJoinError(429, 'Thử lại sau 42 giây')).toEqual({ kind: 'locked', seconds: 42 });
    expect(classifyJoinError(429, 'quá nhiều lần')).toEqual({ kind: 'locked', seconds: 30 });
  });
  it('blames the room code on 403 or a message that names it', () => {
    expect(classifyJoinError(403, 'x')).toEqual({ kind: 'room' });
    expect(classifyJoinError(400, 'Sai Mã phòng')).toEqual({ kind: 'room' });
  });
  it('asks for a more distinct name on 409; shows other messages as they are', () => {
    expect(classifyJoinError(409, 'Tên đã được dùng')).toEqual({ kind: 'name', message: 'Tên đã được dùng. Thêm họ hoặc một chữ để phân biệt.' });
    expect(classifyJoinError(500, 'Lỗi 500')).toEqual({ kind: 'name', message: 'Lỗi 500' });
    expect(classifyJoinError(null, 'boom')).toEqual({ kind: 'name', message: 'Không vào được phiên' });
  });
});

describe('classifyRoomLookupError', () => {
  it('429 → locked with the seconds from the message; 403 → wrong code; 0 → offline; else the message', () => {
    expect(classifyRoomLookupError(429, 'Nhập sai mã phòng quá nhiều lần. Thử lại sau 42 giây')).toEqual({ kind: 'locked', seconds: 42 });
    expect(classifyRoomLookupError(429, 'x')).toEqual({ kind: 'locked', seconds: 30 });
    expect(classifyRoomLookupError(403, 'Mã phòng không đúng')).toMatchObject({ kind: 'wrong' });
    expect(classifyRoomLookupError(0, '')).toMatchObject({ kind: 'offline' });
    expect(classifyRoomLookupError(500, 'Lỗi')).toEqual({ kind: 'other', message: 'Lỗi' });
  });
});
