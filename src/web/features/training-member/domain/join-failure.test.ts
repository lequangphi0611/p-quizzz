import { describe, expect, it } from 'vitest';
import { TRAINING_ROOM_NOT_FOUND, classifyTrainingJoinError, retrySecondsFrom } from './join-failure.js';

describe('classifyTrainingJoinError', () => {
  it('a name already in use asks for another name (no rejoin flow in a training)', () => {
    const f = classifyTrainingJoinError(409, 'Tên đã có người dùng', 'identity_in_use');
    expect(f.kind).toBe('taken');
    expect(f).toMatchObject({ message: expect.stringContaining('Chọn tên khác') });
  });
  it('a 409 without that code is just shown as it is, under the name', () => {
    expect(classifyTrainingJoinError(409, 'Lỗi khác')).toEqual({ kind: 'name', message: 'Lỗi khác' });
  });
  it('a wrong code and a training that stopped read the same (never tell which)', () => {
    expect(classifyTrainingJoinError(403, 'Mã phòng không đúng')).toEqual({ kind: 'room', message: TRAINING_ROOM_NOT_FOUND });
    expect(classifyTrainingJoinError(403, 'bất kỳ')).toEqual({ kind: 'room', message: TRAINING_ROOM_NOT_FOUND });
  });
  it('too many wrong codes (429) reads the wait from the message, with a fallback', () => {
    expect(classifyTrainingJoinError(429, 'Nhập sai mã phòng quá nhiều lần. Thử lại sau 42 giây')).toEqual({ kind: 'locked', seconds: 42 });
    expect(classifyTrainingJoinError(429, 'quá nhiều')).toEqual({ kind: 'locked', seconds: 30 });
  });
  it('no connection is its own failure, not a name problem', () => {
    expect(classifyTrainingJoinError(0, 'Không kết nối được tới máy chủ').kind).toBe('offline');
  });
  it('an invalid name (400) shows the server message; an unknown error gets a generic one', () => {
    expect(classifyTrainingJoinError(400, 'Tên tối đa 30 ký tự')).toEqual({ kind: 'name', message: 'Tên tối đa 30 ký tự' });
    expect(classifyTrainingJoinError(500, '')).toEqual({ kind: 'name', message: 'Không vào được buổi training' });
    expect(classifyTrainingJoinError(null, '')).toEqual({ kind: 'name', message: 'Không vào được buổi training' });
  });
});

describe('retrySecondsFrom', () => {
  it('finds the seconds, or 0', () => {
    expect(retrySecondsFrom('Thử lại sau 7 giây')).toBe(7);
    expect(retrySecondsFrom('không có số')).toBe(0);
  });
});
