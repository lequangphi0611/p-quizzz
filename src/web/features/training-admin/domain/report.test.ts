import { describe, expect, it } from 'vitest';
import { needsExportReminder, reportFileName, reportSummary } from './report.js';

describe('reportFileName', () => {
  it.each([
    ['Buổi 1', 'bao-cao-buoi-1.md'],
    ['Đường đến AI: tuần 3!', 'bao-cao-duong-den-ai-tuan-3.md'],
    ['   ', 'bao-cao-training.md'],
    ['***', 'bao-cao-training.md'],
    ['../../etc/passwd', 'bao-cao-etc-passwd.md'],
  ])('%s → %s', (name, file) => expect(reportFileName(name)).toBe(file));

  it('cuts a long name without leaving a trailing dash', () => {
    const file = reportFileName('một hai ba bốn năm sáu bảy tám chín mười mười một mười hai');
    expect(file.length).toBeLessThanOrEqual('bao-cao-.md'.length + 40);
    expect(file).not.toMatch(/-\.md$/);
  });
});

describe('reportSummary', () => {
  it('counts marks over all members and members with a note', () => {
    expect(reportSummary([{ markedCount: 2, mentorNote: 'a' }, { markedCount: 1, mentorNote: null }, { markedCount: 0, mentorNote: 'b' }])).toEqual({ marked: 3, notes: 2, empty: false });
  });
  it('is empty when nothing was marked and nothing written', () => {
    expect(reportSummary([{ markedCount: 0, mentorNote: null }])).toEqual({ marked: 0, notes: 0, empty: true });
    expect(reportSummary([])).toEqual({ marked: 0, notes: 0, empty: true });
  });
  it('a note alone is enough', () => {
    expect(reportSummary([{ markedCount: 0, mentorNote: 'x' }]).empty).toBe(false);
  });
});

describe('needsExportReminder', () => {
  it('asks until the report was downloaded once', () => {
    expect(needsExportReminder({ reportExportedAt: null })).toBe(true);
    expect(needsExportReminder({ reportExportedAt: 1 })).toBe(false);
  });
});
