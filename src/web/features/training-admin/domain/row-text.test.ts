import { describe, expect, it } from 'vitest';
import { approxSeconds, decisionText, isAutoMode, modeLabel, noteLines, noticeTitle, sessionTitle } from './row-text.js';

describe('row text', () => {
  it('titles each session marker', () => {
    expect(sessionTitle('clear')).toBe('Bắt đầu phiên Claude mới (/clear)');
    expect(sessionTitle('compact_manual')).toContain('/compact');
    expect(sessionTitle('compact_auto')).toContain('tự nén');
    expect(sessionTitle('model_switch')).toBe('Đổi model');
    expect(sessionTitle('exit')).toBe('Thoát Claude Code');
  });
  it('titles the notices', () => {
    expect(noticeTitle('idle')).toContain('nhập');
    expect(noticeTitle('waiting_permission')).toContain('duyệt quyền');
  });
  it('rounds the estimated time and always marks it as an estimate', () => {
    expect(approxSeconds(400)).toBe('~0,4 giây');
    expect(approxSeconds(0)).toBe('~0,1 giây');
    expect(approxSeconds(2400)).toBe('~2 giây');
  });
  it('says the decision is inferred', () => {
    expect(decisionText({ decision: 'allowed', decisionMs: 1500 })).toEqual({ text: 'Đã cho sau ~2 giây (suy ra)', tone: 'ok' });
    expect(decisionText({ decision: 'denied' })).toEqual({ text: 'Không cho (suy ra)', tone: 'no' });
    expect(decisionText({ decision: 'pending' }).tone).toBe('wait');
    expect(decisionText({}).tone).toBe('wait');
  });
  it('names the permission mode only when it is not the default; only the modes that stop asking are "auto"', () => {
    expect(modeLabel(undefined)).toBeNull();
    expect(modeLabel('default')).toBeNull();
    expect(modeLabel('plan')).toBe('Lập kế hoạch');
    expect(modeLabel('somethingNew')).toBe('somethingNew');
    expect(isAutoMode('bypassPermissions')).toBe(true);
    expect(isAutoMode('plan')).toBe(false);
  });
  it('splits the question → choice note into lines', () => {
    expect(noteLines('Dùng thư viện nào? → A\n\nTên file? → b.ts')).toEqual(['Dùng thư viện nào? → A', 'Tên file? → b.ts']);
    expect(noteLines(undefined)).toEqual([]);
  });
});
