import { z } from 'zod';
import type { QuestionType } from '../exam-format/index.js';

// The share page (PRODUCT.md §7.33): sessions the mentor chose to share, read by anyone holding the one share link.
// Questions, the key, explanations and how the class chose. Never a name, score, answer or reason of anyone.

/** Below this many submissions the mentor is warned that the choice counts may give away individual picks (§7.33a). Not a cut-off: counts always show. */
export const SMALL_CLASS_WARNING = 5;

export const SetSharedBody = z.object({ shared: z.boolean() });
export type SetSharedBody = z.infer<typeof SetSharedBody>;

/** Mentor: the token of the share page and how many sessions it lists. */
export interface ShareLinkInfo {
  token: string;
  sharedCount: number;
}

/** One row of the share page. `startedAt` is epoch ms (null only for a session closed before it ever started). */
export interface SharedSessionItem {
  id: number;
  examTitle: string;
  startedAt: number | null;
  questionCount: number;
}

export interface SharedSessionList {
  sessions: SharedSessionItem[];
}

export interface SharedOption {
  id: number;
  position: number;
  text: string;
  isCorrect: boolean;
}

/** How the class chose on one choice question, over the counted submissions. `counts` is keyed by option id. */
export interface SharedDistribution {
  counts: Record<number, number>;
  blank: number;
}

export interface SharedQuestion {
  id: number;
  position: number;
  type: QuestionType;
  prompt: string;
  body: string;
  points: number;
  explanation: string | null;
  options: SharedOption[];
  /** Null for essays and when nobody submitted. */
  distribution: SharedDistribution | null;
}

export interface SharedSessionView extends SharedSessionItem {
  submitted: number;
  questions: SharedQuestion[]; // in exam order
}
