import { describe, expect, it } from 'vitest';
import { FLAG_LABELS } from '../../../shared/api/training.js';
import { buildReport, type ReportExample, type ReportMember } from './report.js';

const at = (h: number, m: number) => new Date(2026, 10, 21, h, m);
const exportedAt = at(16, 5);

const member = (over: Partial<ReportMember> = {}): ReportMember => ({
  displayName: 'Lan', stoppedSending: false, promptCount: 12, toolCount: 30, failedCount: 3, clearCount: 1, compactCount: 0, permissionCount: 4,
  flags: [], note: null, examples: [], ...over,
});
const prompt = (text: string): ReportExample => ({ at: at(14, 3), kind: 'prompt', prompt: text, toolName: null, toolTarget: null, ok: null, subtype: null });
const tool = (target: string, ok: boolean): ReportExample => ({ at: at(14, 9), kind: 'tool', prompt: null, toolName: 'Bash', toolTarget: target, ok, subtype: null });

describe('buildReport', () => {
  it('starts with the name and the time, and says what the file does not carry', () => {
    const text = buildReport({ trainingName: 'Buổi 1', exportedAt, members: [member()] });
    expect(text).toMatch(/^# Báo cáo buổi training: Buổi 1\n/);
    expect(text).toContain('Xuất lúc 21/11/2026 16:05 · 1 bạn');
    expect(text).toContain('không có output hay nội dung file');
    expect(text).toContain('không phải đánh giá');
  });

  it('shows the class in counts only and in the fixed flag order', () => {
    const text = buildReport({
      trainingName: 'B',
      exportedAt,
      members: [member({ displayName: 'Lan', flags: ['repeated_request', 'repeated_failure'] }), member({ displayName: 'Mai', flags: ['repeated_request'] }), member({ displayName: 'Nam' })],
    });
    const summary = text.slice(text.indexOf('## Tổng hợp lớp'), text.indexOf('## Từng bạn'));
    expect(summary).toContain(`- 1/3 bạn: ${FLAG_LABELS.repeated_failure}`);
    expect(summary).toContain(`- 2/3 bạn: ${FLAG_LABELS.repeated_request}`);
    expect(summary.indexOf(FLAG_LABELS.repeated_failure)).toBeLessThan(summary.indexOf(FLAG_LABELS.repeated_request));
    expect(summary).not.toMatch(/Lan|Mai|Nam/);
    expect(summary).not.toMatch(/trung vị|xếp hạng/);
  });

  it('says so when no flag is up', () => {
    expect(buildReport({ trainingName: 'B', exportedAt, members: [member()] })).toContain('Chưa có cờ gợi ý nào.');
  });

  it('lists each member by name with figures, flags, note and marked examples', () => {
    const text = buildReport({
      trainingName: 'B',
      exportedAt,
      members: [member({ flags: ['touches_tests'], note: 'Cần nhắc chạy test\nsau mỗi lần sửa', examples: [prompt('Sửa lỗi giúp mình'), tool('npm test', false)] })],
    });
    expect(text).toContain('### Lan\n');
    expect(text).toContain('12 prompt · 30 lệnh (3 lỗi) · /clear 1 · nén 0 · xin quyền 4');
    expect(text).toContain(`Cờ gợi ý: ${FLAG_LABELS.touches_tests}`);
    expect(text).toContain('> Cần nhắc chạy test\n> sau mỗi lần sửa');
    expect(text).toContain('1. 14:03 · Prompt\n   > Sửa lỗi giúp mình');
    expect(text).toContain('2. 14:09 · Bash `npm test` · lỗi');
  });

  it('marks a member who stopped sending', () => {
    const text = buildReport({ trainingName: 'B', exportedAt, members: [member({ stoppedSending: true })] });
    expect(text).toContain('### Lan (đã dừng gửi)');
  });

  it('keeps a multi-line prompt inside its list item and cuts a very long one', () => {
    const text = buildReport({ trainingName: 'B', exportedAt, members: [member({ examples: [prompt(`dòng một\n\n# không phải tiêu đề\n${'x'.repeat(2000)}`)] })] });
    expect(text).toContain('   > # không phải tiêu đề');
    expect(text).not.toMatch(/^# không phải tiêu đề/m);
    expect(text).toContain('…');
    expect(text.length).toBeLessThan(2000);
  });

  it('masks anything that looks like a secret, whichever field it came in through', () => {
    const text = buildReport({
      trainingName: 'Buổi sk-liveabcdefghijklmnop',
      exportedAt,
      members: [member({ note: 'đã thấy TOKEN=abcdefgh12345678', examples: [prompt('dùng sk-aaaaaaaaaaaaaaaaaaaa'), tool('curl -H "api_key: zzzz1234zzzz5678" x', true)] })],
    });
    for (const secret of ['sk-liveabcdefghijklmnop', 'abcdefgh12345678', 'sk-aaaaaaaaaaaaaaaaaaaa', 'zzzz1234zzzz5678']) expect(text).not.toContain(secret);
  });

  it('handles an empty class', () => {
    expect(buildReport({ trainingName: 'B', exportedAt, members: [] })).toContain('Chưa có bạn nào trong buổi.');
  });
});
