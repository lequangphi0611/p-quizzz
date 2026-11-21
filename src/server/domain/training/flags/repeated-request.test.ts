import { beforeEach, describe, expect, it } from 'vitest';
import { repeatedRequest, similarity } from './repeated-request.js';
import { ctx, prompt, resetEvents } from './test-events.js';

beforeEach(resetEvents);

describe('similarity', () => {
  it('is the share of words in common', () => {
    expect(similarity('sửa lỗi đăng nhập', 'sửa lỗi đăng nhập')).toBe(1);
    expect(similarity('a b c d', 'a b c e')).toBeCloseTo(0.6);
    expect(similarity('a', 'b')).toBe(0);
  });
});

describe('repeatedRequest', () => {
  it('goes up with three nearly identical prompts in a row', () => {
    const events = ['sửa lỗi đăng nhập giúp tôi', 'sửa lỗi đăng nhập giúp tôi', 'sửa lỗi đăng nhập giúp tôi nhé'].map(t => prompt(t));
    expect(repeatedRequest(events, ctx())).toEqual({ code: 'repeated_request', eventIds: events.map(e => e.id) });
  });
  it('goes up when the prompts only say it still fails', () => {
    const events = ['viết hàm cộng hai số', 'vẫn lỗi', 'vẫn không chạy được', 'still failing again'].map(t => prompt(t));
    expect(repeatedRequest(events, ctx())?.eventIds).toEqual(events.map(e => e.id));
  });
  it('stays down for two prompts, or different requests', () => {
    expect(repeatedRequest([prompt('sửa lỗi A'), prompt('sửa lỗi A')], ctx())).toBeNull();
    expect(repeatedRequest([prompt('viết hàm cộng'), prompt('thêm test cho hàm đó'), prompt('đổi tên file thành main')], ctx())).toBeNull();
  });
  it('a long prompt that happens to mention "lỗi" is not a repeat', () => {
    const long = `${'tạo trang đăng nhập mới '.repeat(6)}vẫn lỗi`;
    expect(repeatedRequest([prompt('a b'), prompt(long), prompt('khác hẳn nội dung')], ctx())).toBeNull();
  });
});
