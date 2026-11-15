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

// Retake rule from PRODUCT.md §4: exams with essays get one attempt; pure multiple-choice exams allow retakes.
export function retakeLabel(hasEssay: boolean): string {
  return hasEssay ? 'Có tự luận → mỗi người làm 1 lần' : 'Không có tự luận → cho làm lại (tính lượt tốt nhất)';
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
