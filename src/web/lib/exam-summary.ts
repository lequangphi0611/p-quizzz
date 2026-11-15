import type { QuestionType } from '../../shared/exam-format/index.js';

export interface ExamTypeCounts {
  single: number;
  multi: number;
  essay: number;
}

export function countByType(questions: { type: QuestionType }[]): ExamTypeCounts {
  const counts: ExamTypeCounts = { single: 0, multi: 0, essay: 0 };
  for (const q of questions) counts[q.type]++;
  return counts;
}

// PRODUCT.md §4.4: every exam is one attempt per participant per session; essays are graded by hand afterwards.
export function attemptRuleLabel(hasEssay: boolean): string {
  return hasEssay ? 'Mỗi người làm 1 lượt · có tự luận → mentor chấm tay sau khi đóng phiên' : 'Mỗi người làm 1 lượt · chấm tự động';
}

export function typeCountsLabel(c: ExamTypeCounts): string {
  const parts = [
    c.single > 0 && `${c.single} một đáp án`,
    c.multi > 0 && `${c.multi} nhiều đáp án`,
    c.essay > 0 && `${c.essay} tự luận`,
  ].filter(Boolean);
  return parts.join(' · ') || 'Chưa có câu hỏi';
}

// Lines of `source` split the same way the parser numbers them (handles CRLF and a leading BOM).
export function splitSourceLines(source: string): string[] {
  return source.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
}
