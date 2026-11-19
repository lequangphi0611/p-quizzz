// GET /api/admin/sessions/:id/discussion — the post-session "Thảo luận" screen (S17, PRODUCT.md §7.17).
// Nothing here may identify who wrote an answer: no names, participant/attempt ids, or join order.

export interface DiscussionOption {
  id: number;
  text: string;
  isCorrect: boolean;
  count: number; // counted submissions that picked this option
}

export interface DiscussionAnswer {
  answerId: number; // needed to grade (PUT /api/admin/answers/:id/grade)
  label: string; // "Bài #k", k in a stable shuffled order
  textAnswer: string | null; // null / blank = left empty
  manualScore: number | null;
  feedback: string | null;
}

// One counted submission that picked something on a `{reason}` question (PRODUCT.md §7.32e). Anonymous: no id, name or
// join order; listed in a stable shuffled order. `text` null = picked but no reason (auto-submitted when time ran out).
export interface DiscussionReason {
  optionIds: number[]; // the options this submission picked, sorted by id
  text: string | null;
}

export interface DiscussionQuestion {
  id: number;
  position: number;
  type: 'single' | 'multi' | 'essay';
  prompt: string;
  body: string;
  points: number;
  explanation: string | null;
  options: DiscussionOption[]; // multiple choice, by position; [] for essays
  correctCount: number; // submissions with full marks on this question (multiple choice)
  blankCount: number; // submissions that chose nothing / wrote nothing
  answers: DiscussionAnswer[]; // essays only, shuffled; [] for multiple choice
  requireReason: boolean;
  reasons: DiscussionReason[]; // `{reason}` questions only, shuffled; [] otherwise
}

export interface DiscussionView {
  sessionId: number;
  examTitle: string;
  status: 'closed' | 'finalized';
  submitted: number; // counted submissions
  graded: number; // essay answers graded so far…
  total: number; // …out of all essay answers that count
  questions: DiscussionQuestion[];
}
