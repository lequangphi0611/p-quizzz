export type ReviewMarkKind = 'correct' | 'wrong' | 'partial' | 'pending';
export interface ReviewMark { kind: ReviewMarkKind; text: string }

/** One-line plain text of a Markdown prompt for the sidebar (no backticks / emphasis markers). */
export const plainPrompt = (s: string): string => s.replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
