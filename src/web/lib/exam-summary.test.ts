import { describe, expect, it } from 'vitest';
import { attemptRuleLabel, countByType, splitSourceLines, typeCountsLabel } from './exam-summary.js';

describe('exam summary helpers', () => {
  it('counts questions by type', () => {
    expect(countByType([{ type: 'single' }, { type: 'multi' }, { type: 'single' }, { type: 'essay' }])).toEqual({ single: 2, multi: 1, essay: 1 });
  });

  it('describes counts, skipping zero types', () => {
    expect(typeCountsLabel({ single: 2, multi: 0, essay: 1 })).toBe('2 một đáp án · 1 tự luận');
    expect(typeCountsLabel({ single: 0, multi: 0, essay: 0 })).toBe('Chưa có câu hỏi');
  });

  it('states the one-attempt rule, and mentions manual grading only when there are essays', () => {
    expect(attemptRuleLabel(false)).toContain('1 lượt');
    expect(attemptRuleLabel(false)).not.toContain('chấm tay');
    expect(attemptRuleLabel(true)).toContain('1 lượt');
    expect(attemptRuleLabel(true)).toContain('chấm tay');
  });

  it('splits lines like the parser (CRLF, BOM)', () => {
    expect(splitSourceLines('﻿a\r\nb\rc\nd')).toEqual(['a', 'b', 'c', 'd']);
  });
});
