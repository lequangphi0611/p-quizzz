import { describe, expect, it } from 'vitest';
import { countByType, retakeLabel, splitSourceLines, typeCountsLabel } from './exam-summary.js';

describe('exam summary helpers', () => {
  it('counts questions by type', () => {
    expect(countByType([{ type: 'single' }, { type: 'multi' }, { type: 'single' }, { type: 'essay' }])).toEqual({ single: 2, multi: 1, essay: 1 });
  });

  it('describes counts, skipping zero types', () => {
    expect(typeCountsLabel({ single: 2, multi: 0, essay: 1 })).toBe('2 một đáp án · 1 tự luận');
    expect(typeCountsLabel({ single: 0, multi: 0, essay: 0 })).toBe('Chưa có câu hỏi');
  });

  it('states the retake rule from hasEssay', () => {
    expect(retakeLabel(true)).toContain('1 lần');
    expect(retakeLabel(false)).toContain('làm lại');
  });

  it('splits lines like the parser (CRLF, BOM)', () => {
    expect(splitSourceLines('﻿a\r\nb\rc\nd')).toEqual(['a', 'b', 'c', 'd']);
  });
});
