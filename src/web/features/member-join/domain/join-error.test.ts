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
  it('sends the member back to the room step when the session is not open', () => {
    expect(classifyJoinError(409, 'Phiên thi không mở')).toEqual({ kind: 'room' });
  });

  it('shows other 409 messages as they are, without the "more distinct name" hint', () => {
    expect(classifyJoinError(409, 'Có lỗi khác')).toEqual({ kind: 'name', message: 'Có lỗi khác' });
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

describe('classifyJoinError with emails (PRODUCT.md §7.22)', () => {
  it('"not on the list" and a malformed email belong under the email field, with the server\'s own words', () => {
    expect(classifyJoinError(403, 'Email này không có trong danh sách của phòng. Kiểm tra lại, hoặc nhắn mentor.')).toEqual({ kind: 'email', message: 'Email này không có trong danh sách của phòng. Kiểm tra lại, hoặc nhắn mentor.' });
    expect(classifyJoinError(400, 'Email chưa đúng định dạng')).toEqual({ kind: 'email', message: 'Email chưa đúng định dạng' });
    expect(classifyJoinError(400, 'Nhập email của bạn')).toMatchObject({ kind: 'email' });
  });
  it('a wrong room code is still a room error, not an email one', () => {
    expect(classifyJoinError(403, 'Mã phòng không đúng')).toEqual({ kind: 'room' });
  });
  it('identity_in_use (email or name already inside) is its own kind, for the "ask the mentor" step', () => {
    expect(classifyJoinError(409, 'Email này đã có người vào phòng', 'identity_in_use')).toEqual({ kind: 'taken', message: 'Email này đã có người vào phòng' });
    expect(classifyJoinError(409, 'Tên đã có người dùng')).toMatchObject({ kind: 'name' }); // old behaviour without the code
  });
});
